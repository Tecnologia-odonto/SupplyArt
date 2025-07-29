/*
  # Create locations table

  1. New Tables
    - `locations`
      - `id` (uuid, primary key)
      - `name` (text, required)
      - `description` (text, optional)
      - `unit_id` (uuid, foreign key to units)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `locations` table
    - Add policies for authenticated users based on role and unit access

  3. Indexes
    - Add index on unit_id for better query performance
*/

CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_locations_unit_id ON locations(unit_id);

-- RLS Policies
CREATE POLICY "Users can manage locations based on permissions"
  ON locations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = uid()
      AND (
        profiles.role IN ('admin', 'gestor', 'operador-almoxarife')
        OR (profiles.role = 'operador-administrativo' AND profiles.unit_id = locations.unit_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = uid()
      AND (
        profiles.role IN ('admin', 'gestor', 'operador-almoxarife')
        OR (profiles.role = 'operador-administrativo' AND profiles.unit_id = locations.unit_id)
      )
    )
  );

CREATE POLICY "Users can read locations based on unit access"
  ON locations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = uid()
      AND (
        profiles.role IN ('admin', 'gestor', 'operador-almoxarife')
        OR (profiles.role = 'operador-administrativo' AND profiles.unit_id = locations.unit_id)
      )
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add audit trigger
CREATE TRIGGER audit_trigger_locations
  AFTER INSERT OR UPDATE OR DELETE ON locations
  FOR EACH ROW
  EXECUTE FUNCTION create_audit_log();