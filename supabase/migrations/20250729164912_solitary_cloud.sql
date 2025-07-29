/*
  # Add requires_maintenance column to items table

  1. Changes
    - Add `requires_maintenance` column to `items` table
    - Set default value to `false`
    - Column is boolean and nullable for backward compatibility

  2. Notes
    - This column tracks whether an item requires preventive maintenance
    - Used in conjunction with `has_lifecycle` for inventory management
*/

-- Add requires_maintenance column to items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'items' AND column_name = 'requires_maintenance'
  ) THEN
    ALTER TABLE items ADD COLUMN requires_maintenance boolean DEFAULT false;
  END IF;
END $$;