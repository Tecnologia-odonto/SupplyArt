/*
  # Create locations table

  1. New Tables
    - `locations`
      - `id` (uuid, primary key)
      - `name` (text, not null)
      - `description` (text, nullable)
      - `unit_id` (uuid, foreign key to units)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `locations` table
    - Add policies for different user roles based on unit access

  3. Triggers
    - Add trigger to update `updated_at` column
    - Add audit trigger for change tracking
*/

CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Policies for locations access
CREATE POLICY "Admins and gestors can manage locations"
  ON locations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = uid()
      AND profiles.role IN ('admin', 'gestor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = uid()
      AND profiles.role IN ('admin', 'gestor')
    )
  );

CREATE POLICY "Administrative operators can manage locations of their unit"
  ON locations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = uid()
      AND profiles.role = 'operador-administrativo'
      AND profiles.unit_id = locations.unit_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = uid()
      AND profiles.role = 'operador-administrativo'
      AND profiles.unit_id = locations.unit_id
    )
  );

CREATE POLICY "All authenticated users can read locations"
  ON locations
  FOR SELECT
  TO authenticated
  USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add audit trigger
CREATE TRIGGER audit_trigger_locations
  AFTER INSERT OR UPDATE OR DELETE ON locations
  FOR EACH ROW
  EXECUTE FUNCTION create_audit_log();