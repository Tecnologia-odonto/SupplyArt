/*
  # Fix locations table structure for unit arrays

  1. Changes
    - Drop existing unit_id column
    - Add unit_ids array column
    - Update RLS policies for array operations
    - Add proper indexes for array queries

  2. Security
    - Update RLS policies to work with arrays
    - Maintain proper access control
*/

-- Drop existing foreign key constraint if it exists
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_unit_id_fkey;

-- Drop the old unit_id column
ALTER TABLE locations DROP COLUMN IF EXISTS unit_id;

-- Add the new unit_ids array column
ALTER TABLE locations ADD COLUMN IF NOT EXISTS unit_ids uuid[] NOT NULL DEFAULT '{}';

-- Create index for array operations
CREATE INDEX IF NOT EXISTS idx_locations_unit_ids ON locations USING GIN (unit_ids);

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Administrative operators can manage locations of their unit" ON locations;
DROP POLICY IF EXISTS "Admins can manage all locations" ON locations;
DROP POLICY IF EXISTS "Almoxarife can read all locations" ON locations;
DROP POLICY IF EXISTS "Financial operators can read all locations" ON locations;
DROP POLICY IF EXISTS "Gestors can manage locations of their unit" ON locations;

-- Create new RLS policies for array operations
CREATE POLICY "Administrative operators can manage locations of their unit"
  ON locations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = uid()
      AND profiles.role = 'operador-administrativo'
      AND profiles.unit_id = ANY(locations.unit_ids)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = uid()
      AND profiles.role = 'operador-administrativo'
      AND profiles.unit_id = ANY(locations.unit_ids)
    )
  );

CREATE POLICY "Admins can manage all locations"
  ON locations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Gestors can manage locations of their unit"
  ON locations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = uid()
      AND profiles.role = 'gestor'
      AND profiles.unit_id = ANY(locations.unit_ids)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = uid()
      AND profiles.role = 'gestor'
      AND profiles.unit_id = ANY(locations.unit_ids)
    )
  );

CREATE POLICY "Almoxarife can read all locations"
  ON locations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = uid()
      AND profiles.role = 'operador-almoxarife'
    )
  );

CREATE POLICY "Financial operators can read all locations"
  ON locations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = uid()
      AND profiles.role = 'operador-financeiro'
    )
  );