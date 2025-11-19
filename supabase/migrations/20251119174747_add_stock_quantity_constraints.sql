/*
  # Adicionar Constraints de Quantidade Não-Negativa

  ## Problema
  - Estoques podem ficar negativos se não houver validação
  - Precisa garantir integridade dos dados
  
  ## Solução
  - Adicionar CHECK constraints em todas as tabelas de estoque
  - Garantir que quantity >= 0
  
  ## Tabelas Afetadas
  - stock
  - cd_stock
  - em_rota
*/

-- Adicionar constraint na tabela stock (estoque das unidades)
DO $$
BEGIN
  -- Primeiro, corrigir qualquer valor negativo existente
  UPDATE stock SET quantity = 0 WHERE quantity < 0;
  
  -- Adicionar constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stock_quantity_non_negative'
  ) THEN
    ALTER TABLE stock ADD CONSTRAINT stock_quantity_non_negative CHECK (quantity >= 0);
  END IF;
END $$;

-- Adicionar constraint na tabela cd_stock (estoque dos CDs)
DO $$
BEGIN
  -- Primeiro, corrigir qualquer valor negativo existente
  UPDATE cd_stock SET quantity = 0 WHERE quantity < 0;
  
  -- Adicionar constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cd_stock_quantity_non_negative'
  ) THEN
    ALTER TABLE cd_stock ADD CONSTRAINT cd_stock_quantity_non_negative CHECK (quantity >= 0);
  END IF;
END $$;

-- Adicionar constraint na tabela em_rota
DO $$
BEGIN
  -- Primeiro, corrigir qualquer valor negativo existente
  UPDATE em_rota SET quantity = 0 WHERE quantity < 0;
  
  -- Adicionar constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'em_rota_quantity_positive'
  ) THEN
    ALTER TABLE em_rota ADD CONSTRAINT em_rota_quantity_positive CHECK (quantity > 0);
  END IF;
END $$;

-- Adicionar constraint na tabela request_items (quantidade solicitada deve ser positiva)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'request_items_quantity_positive'
  ) THEN
    ALTER TABLE request_items ADD CONSTRAINT request_items_quantity_positive CHECK (quantity_requested > 0);
  END IF;
END $$;