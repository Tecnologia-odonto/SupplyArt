/*
  # Add unit_price column to request_items table

  1. Changes
    - Add `unit_price` column to `request_items` table
    - Column type: numeric (allows decimal values for prices)
    - Allow NULL values (not all request items may have prices initially)
    - Add check constraint to ensure positive values when set

  2. Security
    - No changes to RLS policies needed
    - Existing policies will cover the new column
*/

-- Add unit_price column to request_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'request_items' AND column_name = 'unit_price'
  ) THEN
    ALTER TABLE request_items ADD COLUMN unit_price numeric;
  END IF;
END $$;

-- Add check constraint to ensure positive prices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'request_items_unit_price_check'
  ) THEN
    ALTER TABLE request_items ADD CONSTRAINT request_items_unit_price_check CHECK ((unit_price IS NULL) OR (unit_price >= 0));
  END IF;
END $$;