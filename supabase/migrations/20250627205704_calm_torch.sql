/*
  # Add error tracking columns to request_items table

  1. New Columns
    - `has_error` (boolean) - Flag to indicate if the item has an error
    - `error_description` (text) - Description of the error for the item

  2. Changes
    - Add `has_error` column with default value false
    - Add `error_description` column allowing null values
    - These columns support error tracking functionality in request items
*/

-- Add has_error column to track items with errors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'request_items' AND column_name = 'has_error'
  ) THEN
    ALTER TABLE request_items ADD COLUMN has_error boolean DEFAULT false;
  END IF;
END $$;

-- Add error_description column to store error details
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'request_items' AND column_name = 'error_description'
  ) THEN
    ALTER TABLE request_items ADD COLUMN error_description text;
  END IF;
END $$;