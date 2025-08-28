/*
  # Adicionar consumo de orçamento aos pedidos

  1. Alterações na Tabela requests
    - Adicionar coluna `total_estimated_cost` para valor total estimado
    - Adicionar coluna `budget_consumed` para controlar se já consumiu orçamento
    - Adicionar coluna `budget_consumption_date` para auditoria

  2. Alterações na Tabela request_items
    - Adicionar coluna `estimated_unit_price` baseado no CD
    - Adicionar coluna `estimated_total_price` calculado

  3. Função para calcular custo do pedido
    - Função que calcula o custo baseado nos preços do CD
*/

-- Adicionar colunas de orçamento aos pedidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'total_estimated_cost'
  ) THEN
    ALTER TABLE requests ADD COLUMN total_estimated_cost numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'budget_consumed'
  ) THEN
    ALTER TABLE requests ADD COLUMN budget_consumed boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'budget_consumption_date'
  ) THEN
    ALTER TABLE requests ADD COLUMN budget_consumption_date timestamptz;
  END IF;
END $$;

-- Adicionar colunas de preço aos itens do pedido
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'request_items' AND column_name = 'estimated_unit_price'
  ) THEN
    ALTER TABLE request_items ADD COLUMN estimated_unit_price numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'request_items' AND column_name = 'estimated_total_price'
  ) THEN
    ALTER TABLE request_items ADD COLUMN estimated_total_price numeric DEFAULT 0;
  END IF;
END $$;

-- Função para calcular custo estimado do pedido
CREATE OR REPLACE FUNCTION calculate_request_estimated_cost(request_id_param uuid)
RETURNS numeric AS $$
DECLARE
  total_cost numeric := 0;
  item_record RECORD;
BEGIN
  -- Para cada item do pedido, buscar o preço no CD e calcular o total
  FOR item_record IN
    SELECT 
      ri.item_id,
      ri.quantity_requested,
      r.cd_unit_id
    FROM request_items ri
    JOIN requests r ON r.id = ri.request_id
    WHERE ri.request_id = request_id_param
  LOOP
    -- Buscar preço do item no estoque do CD
    SELECT COALESCE(cs.unit_price, 0) * item_record.quantity_requested
    INTO total_cost
    FROM cd_stock cs
    WHERE cs.item_id = item_record.item_id 
      AND cs.cd_unit_id = item_record.cd_unit_id;
    
    -- Somar ao total
    total_cost := total_cost + COALESCE(total_cost, 0);
  END LOOP;
  
  RETURN COALESCE(total_cost, 0);
END;
$$ LANGUAGE plpgsql;

-- Função para consumir orçamento quando pedido é aprovado
CREATE OR REPLACE FUNCTION consume_budget_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  estimated_cost numeric;
  budget_record RECORD;
BEGIN
  -- Verificar se o status mudou para 'aprovado' e ainda não consumiu orçamento
  IF NEW.status = 'aprovado' AND OLD.status != 'aprovado' AND NOT COALESCE(NEW.budget_consumed, false) THEN
    
    -- Calcular custo estimado
    estimated_cost := calculate_request_estimated_cost(NEW.id);
    
    -- Buscar orçamento da unidade solicitante
    SELECT * INTO budget_record
    FROM unit_budgets
    WHERE unit_id = NEW.requesting_unit_id
      AND period_start <= CURRENT_DATE
      AND period_end >= CURRENT_DATE
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Verificar se há orçamento disponível
    IF budget_record IS NULL THEN
      RAISE EXCEPTION 'Unidade não possui orçamento válido para o período atual';
    END IF;
    
    IF budget_record.available_amount < estimated_cost THEN
      RAISE EXCEPTION 'Orçamento insuficiente. Disponível: %, Necessário: %', 
        budget_record.available_amount, estimated_cost;
    END IF;
    
    -- Consumir orçamento
    UPDATE unit_budgets
    SET used_amount = used_amount + estimated_cost,
        available_amount = available_amount - estimated_cost
    WHERE id = budget_record.id;
    
    -- Marcar como orçamento consumido
    NEW.budget_consumed := true;
    NEW.budget_consumption_date := now();
    NEW.total_estimated_cost := estimated_cost;
    
    -- Criar transação financeira
    INSERT INTO financial_transactions (
      type,
      amount,
      description,
      unit_id,
      reference_type,
      reference_id,
      created_by
    ) VALUES (
      'expense',
      estimated_cost,
      'Consumo de orçamento - Pedido interno #' || LEFT(NEW.id::text, 8),
      NEW.requesting_unit_id,
      'request',
      NEW.id,
      NEW.requester_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para consumo de orçamento
DROP TRIGGER IF EXISTS consume_budget_on_request_approval ON requests;
CREATE TRIGGER consume_budget_on_request_approval
  BEFORE UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION consume_budget_on_approval();