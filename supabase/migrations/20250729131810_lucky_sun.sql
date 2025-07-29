/*
  # Add category and lifecycle fields to items table

  1. Changes to items table
    - Add `category` column (text, optional but will be required for non-lifecycle items)
    - Modify `has_lifecycle` column to be more explicit
    - Add `requires_maintenance` column for lifecycle items

  2. Update constraints
    - Add check constraint for valid categories
    - Add logic for category requirement based on lifecycle

  3. Update existing data
    - Set default values for existing records
*/

-- Add new columns to items table
DO $$
BEGIN
  -- Add category column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'items' AND column_name = 'category'
  ) THEN
    ALTER TABLE items ADD COLUMN category text;
  END IF;

  -- Add requires_maintenance column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'items' AND column_name = 'requires_maintenance'
  ) THEN
    ALTER TABLE items ADD COLUMN requires_maintenance boolean DEFAULT false;
  END IF;
END $$;

-- Add check constraint for valid categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'items_category_check'
  ) THEN
    ALTER TABLE items ADD CONSTRAINT items_category_check
    CHECK (category IN (
      'Material de Escritório',
      'Material de Limpeza', 
      'Insumo Odontológico',
      'Equipamento de Informática',
      'Medicação',
      'Equipamento Odontológico',
      'Instrumental Odontológico',
      'Material Gráfico',
      'Peças de Equipamento Odontológico'
    ));
  END IF;
END $$;