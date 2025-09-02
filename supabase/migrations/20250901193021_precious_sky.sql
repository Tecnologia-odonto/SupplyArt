/*
  # Atualizar sistema de cotações para usar código do item

  1. Alterações nas Tabelas
    - Alterar `quotation_items` para usar `item_code` ao invés de `item_id`
    - Alterar `quotation_responses` para usar `item_code` ao invés de `item_id`
    - Alterar `price_history` para usar `item_code` ao invés de `item_id`
    - Manter foreign keys onde necessário para integridade

  2. Índices
    - Adicionar índices para `item_code` nas tabelas relevantes
    - Manter performance das consultas

  3. Políticas RLS
    - Manter as mesmas políticas de segurança
*/

-- Alterar quotation_items para usar item_code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotation_items' AND column_name = 'item_code'
  ) THEN
    ALTER TABLE quotation_items ADD COLUMN item_code text;
  END IF;
END $$;

-- Alterar quotation_responses para usar item_code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotation_responses' AND column_name = 'item_code'
  ) THEN
    ALTER TABLE quotation_responses ADD COLUMN item_code text;
  END IF;
END $$;

-- Alterar price_history para usar item_code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'price_history' AND column_name = 'item_code'
  ) THEN
    ALTER TABLE price_history ADD COLUMN item_code text;
  END IF;
END $$;

-- Preencher item_code nas tabelas existentes (se houver dados)
UPDATE quotation_items 
SET item_code = (SELECT code FROM items WHERE items.id = quotation_items.item_id)
WHERE item_code IS NULL AND item_id IS NOT NULL;

UPDATE quotation_responses 
SET item_code = (SELECT code FROM items WHERE items.id = quotation_responses.item_id)
WHERE item_code IS NULL AND item_id IS NOT NULL;

UPDATE price_history 
SET item_code = (SELECT code FROM items WHERE items.id = price_history.item_id)
WHERE item_code IS NULL AND item_id IS NOT NULL;

-- Adicionar índices para item_code
CREATE INDEX IF NOT EXISTS idx_quotation_items_item_code ON quotation_items(item_code);
CREATE INDEX IF NOT EXISTS idx_quotation_responses_item_code ON quotation_responses(item_code);
CREATE INDEX IF NOT EXISTS idx_price_history_item_code ON price_history(item_code);

-- Adicionar constraints para garantir que item_code seja obrigatório
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'quotation_items' AND constraint_name = 'quotation_items_item_code_not_null'
  ) THEN
    ALTER TABLE quotation_items ADD CONSTRAINT quotation_items_item_code_not_null CHECK (item_code IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'quotation_responses' AND constraint_name = 'quotation_responses_item_code_not_null'
  ) THEN
    ALTER TABLE quotation_responses ADD CONSTRAINT quotation_responses_item_code_not_null CHECK (item_code IS NOT NULL);
  END IF;
END $$;