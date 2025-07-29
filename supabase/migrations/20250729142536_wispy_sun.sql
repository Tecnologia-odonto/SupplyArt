/*
  # Create complete locations table

  1. New Tables
    - `locations`
      - `id` (uuid, primary key)
      - `name` (text, unique per unit)
      - `description` (text, optional)
      - `unit_id` (uuid, foreign key to units)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on `locations` table
    - Add policies for different user roles
    
  3. Indexes
    - Index on unit_id for performance
    - Unique constraint on name per unit
*/

-- Drop table if exists to recreate properly
DROP TABLE IF EXISTS public.locations CASCADE;

-- Create locations table
CREATE TABLE IF NOT EXISTS public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  unit_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT locations_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE,
  CONSTRAINT locations_name_unit_unique UNIQUE (name, unit_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_locations_unit_id ON public.locations(unit_id);
CREATE INDEX IF NOT EXISTS idx_locations_name ON public.locations(name);

-- Enable RLS
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage all locations"
  ON public.locations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Gestors can manage locations of their unit"
  ON public.locations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gestor'
      AND profiles.unit_id = locations.unit_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gestor'
      AND profiles.unit_id = locations.unit_id
    )
  );

CREATE POLICY "Administrative operators can manage locations of their unit"
  ON public.locations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operador-administrativo'
      AND profiles.unit_id = locations.unit_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operador-administrativo'
      AND profiles.unit_id = locations.unit_id
    )
  );

CREATE POLICY "Almoxarife can read all locations"
  ON public.locations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operador-almoxarife'
    )
  );

CREATE POLICY "Financial operators can read all locations"
  ON public.locations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operador-financeiro'
    )
  );

-- Create triggers
CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER audit_trigger_locations
  AFTER INSERT OR DELETE OR UPDATE ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION create_audit_log();

-- Insert some default locations for existing units
INSERT INTO public.locations (name, description, unit_id)
SELECT 
  'Estoque Geral',
  'Localização padrão para estoque geral',
  units.id
FROM public.units
WHERE units.is_cd = false
ON CONFLICT (name, unit_id) DO NOTHING;

INSERT INTO public.locations (name, description, unit_id)
SELECT 
  'Recepção',
  'Área de recepção e atendimento',
  units.id
FROM public.units
WHERE units.is_cd = false
ON CONFLICT (name, unit_id) DO NOTHING;

INSERT INTO public.locations (name, description, unit_id)
SELECT 
  'Administração',
  'Setor administrativo',
  units.id
FROM public.units
WHERE units.is_cd = false
ON CONFLICT (name, unit_id) DO NOTHING;