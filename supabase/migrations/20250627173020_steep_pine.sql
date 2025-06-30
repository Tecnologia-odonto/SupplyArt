/*
  # Adicionar campo description à tabela inventory

  1. Alterações
    - Adicionar coluna `description` na tabela `inventory`
    - Campo opcional para descrição específica do item no inventário
*/

-- Adicionar coluna description na tabela inventory
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory' AND column_name = 'description'
  ) THEN
    ALTER TABLE inventory ADD COLUMN description text;
  END IF;
END $$;