/*
  # Adicionar preços aos itens do estoque CD

  1. Alterações na Tabela
    - Adicionar coluna `unit_price` na tabela `cd_stock`
    - Adicionar coluna `last_price_update` para rastrear atualizações
    - Adicionar coluna `price_updated_by` para auditoria

  2. Segurança
    - Manter RLS existente
    - Adicionar validação de preço positivo

  3. Índices
    - Adicionar índice para consultas por preço
*/

-- Adicionar colunas de preço ao estoque CD
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cd_stock' AND column_name = 'unit_price'
  ) THEN
    ALTER TABLE cd_stock ADD COLUMN unit_price numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cd_stock' AND column_name = 'last_price_update'
  ) THEN
    ALTER TABLE cd_stock ADD COLUMN last_price_update timestamptz DEFAULT now();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cd_stock' AND column_name = 'price_updated_by'
  ) THEN
    ALTER TABLE cd_stock ADD COLUMN price_updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Adicionar constraint para garantir preço positivo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'cd_stock_unit_price_check'
  ) THEN
    ALTER TABLE cd_stock ADD CONSTRAINT cd_stock_unit_price_check CHECK (unit_price >= 0);
  END IF;
END $$;

-- Adicionar índice para consultas por preço
CREATE INDEX IF NOT EXISTS idx_cd_stock_unit_price ON cd_stock(unit_price);

-- Trigger para atualizar data de alteração de preço
CREATE OR REPLACE FUNCTION update_price_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.unit_price IS DISTINCT FROM NEW.unit_price THEN
    NEW.last_price_update = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_cd_stock_price_timestamp ON cd_stock;
CREATE TRIGGER update_cd_stock_price_timestamp
  BEFORE UPDATE ON cd_stock
  FOR EACH ROW
  EXECUTE FUNCTION update_price_timestamp();