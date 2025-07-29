/*
  # Add location reference to stock table

  1. Changes to stock table
    - Add `location_id` column (uuid, optional foreign key to locations)
    - Update existing location text field to be more flexible

  2. Indexes
    - Add index on location_id for better query performance

  3. Foreign Key
    - Add foreign key constraint to locations table
*/

-- Add location_id column to stock table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE stock ADD COLUMN location_id uuid REFERENCES locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_stock_location_id ON stock(location_id);