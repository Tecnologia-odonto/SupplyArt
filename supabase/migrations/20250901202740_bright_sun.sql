/*
  # Fix quotations structure

  1. Changes
    - Ensure quotation_items uses item_code properly
    - Add indexes for better performance
    - Ensure quotation_responses uses item_code consistently

  2. Security
    - Maintain existing RLS policies
*/

-- Ensure quotation_items has proper item_code handling
DO $$
BEGIN
  -- Update existing quotation_items to have item_code if missing
  UPDATE quotation_items 
  SET item_code = (
    SELECT code 
    FROM items 
    WHERE items.id = quotation_items.item_id
  )
  WHERE item_code IS NULL OR item_code = '';
END $$;

-- Ensure quotation_responses has proper item_code handling  
DO $$
BEGIN
  -- Update existing quotation_responses to have item_code if missing
  UPDATE quotation_responses 
  SET item_code = (
    SELECT code 
    FROM items 
    WHERE items.id = quotation_responses.item_id
  )
  WHERE item_code IS NULL OR item_code = '';
END $$;

-- Add helpful indexes if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'quotation_items' AND indexname = 'idx_quotation_items_quotation_item'
  ) THEN
    CREATE INDEX idx_quotation_items_quotation_item ON quotation_items(quotation_id, item_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'quotation_responses' AND indexname = 'idx_quotation_responses_quotation_item'
  ) THEN
    CREATE INDEX idx_quotation_responses_quotation_item ON quotation_responses(quotation_id, item_id);
  END IF;
END $$;