/*
  # Add foreign key constraint to locations table

  1. Changes
    - Add foreign key constraint linking locations.unit_id to units.id
    - This enables the relationship queries between locations and units

  2. Security
    - No changes to existing RLS policies
*/

-- Add foreign key constraint to link locations to units
ALTER TABLE public.locations 
ADD CONSTRAINT locations_unit_id_fkey 
FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE;