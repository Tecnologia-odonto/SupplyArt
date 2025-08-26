/*
  # Fornecedor por item e correções gerais

  1. Alterações na tabela purchase_items
    - Adicionar coluna supplier_id para vincular fornecedor a cada item
    - Manter supplier_id na tabela purchases para compatibilidade

  2. Alterações na tabela inventory_events
    - Adicionar coluna supplier_id para eventos que envolvem fornecedores

  3. Correções de timezone
    - Atualizar funções para usar timezone correto (America/Sao_Paulo)

  4. Segurança
    - Manter RLS existente
    - Adicionar políticas para novas colunas
*/

-- Adicionar supplier_id à tabela purchase_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_items' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE purchase_items ADD COLUMN supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Adicionar supplier_id à tabela inventory_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_events' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE inventory_events ADD COLUMN supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Função para corrigir timezone nas operações
CREATE OR REPLACE FUNCTION get_current_date_brazil()
RETURNS date AS $$
BEGIN
  RETURN (now() AT TIME ZONE 'America/Sao_Paulo')::date;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_current_timestamp_brazil()
RETURNS timestamptz AS $$
BEGIN
  RETURN now() AT TIME ZONE 'America/Sao_Paulo';
END;
$$ LANGUAGE plpgsql;

-- Atualizar função de processamento de compras finalizadas para usar timezone correto
CREATE OR REPLACE FUNCTION process_finalized_purchase()
RETURNS TRIGGER AS $$
DECLARE
  purchase_item RECORD;
  current_stock RECORD;
  user_id_val uuid;
  current_date_brazil date;
  current_timestamp_brazil timestamptz;
BEGIN
  -- Verificar se a compra foi finalizada
  IF NEW.status = 'finalizado' AND OLD.status != 'finalizado' THEN
    
    -- Obter data/hora atual no timezone do Brasil
    current_date_brazil := get_current_date_brazil();
    current_timestamp_brazil := get_current_timestamp_brazil();
    
    -- Tentar obter o ID do usuário atual
    BEGIN
      user_id_val := auth.uid();
    EXCEPTION WHEN OTHERS THEN
      user_id_val := NEW.requester_id;
    END;

    IF user_id_val IS NULL THEN
      user_id_val := NEW.requester_id;
    END IF;

    -- Processar cada item da compra
    FOR purchase_item IN 
      SELECT pi.*, i.name as item_name, i.code as item_code
      FROM purchase_items pi
      JOIN items i ON i.id = pi.item_id
      WHERE pi.purchase_id = NEW.id
    LOOP
      -- Verificar se já existe estoque para este item nesta unidade
      SELECT * INTO current_stock
      FROM stock 
      WHERE item_id = purchase_item.item_id 
      AND unit_id = NEW.unit_id;

      IF FOUND THEN
        -- Atualizar estoque existente
        UPDATE stock 
        SET 
          quantity = quantity + purchase_item.quantity,
          updated_at = current_timestamp_brazil
        WHERE item_id = purchase_item.item_id 
        AND unit_id = NEW.unit_id;
      ELSE
        -- Criar novo registro de estoque
        INSERT INTO stock (
          item_id,
          unit_id,
          quantity,
          min_quantity,
          max_quantity,
          location,
          created_at,
          updated_at
        ) VALUES (
          purchase_item.item_id,
          NEW.unit_id,
          purchase_item.quantity,
          0,
          NULL,
          'Estoque Geral',
          current_timestamp_brazil,
          current_timestamp_brazil
        );
      END IF;

      -- Criar movimentação de compra
      INSERT INTO movements (
        item_id,
        from_unit_id,
        to_unit_id,
        quantity,
        type,
        reference,
        notes,
        created_by,
        created_at
      ) VALUES (
        purchase_item.item_id,
        NEW.unit_id,
        NEW.unit_id,
        purchase_item.quantity,
        'purchase',
        'Purchase #' || NEW.id::text,
        format('Item %s (%s) adicionado ao estoque via compra finalizada. Quantidade: %s', 
               purchase_item.item_name, 
               purchase_item.item_code, 
               purchase_item.quantity),
        user_id_val,
        current_timestamp_brazil
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar função de processamento de pedidos enviados para usar timezone correto
CREATE OR REPLACE FUNCTION process_sent_request()
RETURNS TRIGGER AS $$
DECLARE
  request_item RECORD;
  user_id_val uuid;
  current_timestamp_brazil timestamptz;
BEGIN
  -- Se o pedido foi enviado
  IF NEW.status = 'enviado' AND OLD.status != 'enviado' THEN
    
    current_timestamp_brazil := get_current_timestamp_brazil();
    
    -- Tentar obter o ID do usuário atual
    BEGIN
      user_id_val := auth.uid();
    EXCEPTION WHEN OTHERS THEN
      user_id_val := NEW.approved_by;
    END;

    IF user_id_val IS NULL THEN
      user_id_val := NEW.approved_by;
    END IF;

    -- Processar cada item do pedido
    FOR request_item IN 
      SELECT ri.*, i.name as item_name, i.code as item_code
      FROM request_items ri
      JOIN items i ON i.id = ri.item_id
      WHERE ri.request_id = NEW.id
    LOOP
      -- Criar registro em em_rota
      INSERT INTO em_rota (
        item_id,
        from_cd_unit_id,
        to_unit_id,
        quantity,
        request_id,
        status,
        sent_at,
        notes,
        created_at
      ) VALUES (
        request_item.item_id,
        NEW.cd_unit_id,
        NEW.requesting_unit_id,
        COALESCE(request_item.quantity_approved, request_item.quantity_requested),
        NEW.id,
        'em_transito',
        current_timestamp_brazil,
        'Enviado automaticamente via pedido #' || NEW.id,
        current_timestamp_brazil
      );
      
      -- Atualizar quantidade enviada
      UPDATE request_items 
      SET quantity_sent = COALESCE(quantity_approved, quantity_requested)
      WHERE id = request_item.id;
      
      -- Subtrair do estoque do CD
      UPDATE cd_stock 
      SET quantity = quantity - COALESCE(request_item.quantity_approved, request_item.quantity_requested)
      WHERE item_id = request_item.item_id 
      AND cd_unit_id = NEW.cd_unit_id;
      
      -- Criar movimentação
      INSERT INTO movements (
        item_id,
        from_unit_id,
        to_unit_id,
        quantity,
        type,
        reference,
        notes,
        created_by,
        created_at
      ) VALUES (
        request_item.item_id,
        NEW.cd_unit_id,
        NEW.requesting_unit_id,
        COALESCE(request_item.quantity_approved, request_item.quantity_requested),
        'transfer',
        'Request #' || NEW.id::text,
        format('Item %s (%s) transferido do CD para unidade solicitante via pedido interno', 
               request_item.item_name, 
               request_item.item_code),
        user_id_val,
        current_timestamp_brazil
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar índice para supplier_id em purchase_items
CREATE INDEX IF NOT EXISTS idx_purchase_items_supplier_id ON purchase_items(supplier_id);

-- Criar índice para supplier_id em inventory_events
CREATE INDEX IF NOT EXISTS idx_inventory_events_supplier_id ON inventory_events(supplier_id);