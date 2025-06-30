/*
  # Sistema de Compras para Estoque

  1. Funcionalidades
    - Quando status da compra muda para 'finalizado', adicionar itens ao estoque
    - Criar movimentações automáticas para rastreamento
    - Atualizar ou criar registros de estoque na unidade
    - Logs de auditoria para todas as operações

  2. Segurança
    - Validações para evitar duplicação
    - Logs detalhados de todas as operações
    - Controle de permissões mantido

  3. Triggers
    - Trigger para processar compras finalizadas
    - Função para adicionar itens ao estoque
    - Criação automática de movimentações
*/

-- Função para processar compra finalizada e adicionar ao estoque
CREATE OR REPLACE FUNCTION process_finalized_purchase()
RETURNS TRIGGER AS $$
DECLARE
  purchase_item RECORD;
  current_stock RECORD;
  user_id_val uuid;
BEGIN
  -- Verificar se a compra foi finalizada
  IF NEW.status = 'finalizado' AND OLD.status != 'finalizado' THEN
    
    -- Tentar obter o ID do usuário atual
    BEGIN
      user_id_val := auth.uid();
    EXCEPTION WHEN OTHERS THEN
      user_id_val := NEW.requester_id; -- Usar o solicitante como fallback
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
          updated_at = now()
        WHERE item_id = purchase_item.item_id 
        AND unit_id = NEW.unit_id;
        
        -- Log da atualização
        INSERT INTO audit_logs (
          user_id,
          action,
          table_name,
          record_id,
          old_values,
          new_values
        ) VALUES (
          user_id_val,
          'STOCK_UPDATED_FROM_PURCHASE',
          'stock',
          current_stock.id::text,
          jsonb_build_object(
            'old_quantity', current_stock.quantity,
            'purchase_id', NEW.id,
            'purchase_item_id', purchase_item.id
          ),
          jsonb_build_object(
            'new_quantity', current_stock.quantity + purchase_item.quantity,
            'added_quantity', purchase_item.quantity,
            'purchase_id', NEW.id,
            'purchase_item_id', purchase_item.id
          )
        );
      ELSE
        -- Criar novo registro de estoque
        INSERT INTO stock (
          item_id,
          unit_id,
          quantity,
          min_quantity,
          max_quantity,
          location
        ) VALUES (
          purchase_item.item_id,
          NEW.unit_id,
          purchase_item.quantity,
          0, -- Quantidade mínima padrão
          NULL, -- Sem máximo definido inicialmente
          'Estoque Geral' -- Localização padrão
        );

        -- Log da criação
        INSERT INTO audit_logs (
          user_id,
          action,
          table_name,
          record_id,
          new_values
        ) VALUES (
          user_id_val,
          'STOCK_CREATED_FROM_PURCHASE',
          'stock',
          NULL, -- Será preenchido pelo trigger de stock
          jsonb_build_object(
            'item_id', purchase_item.item_id,
            'unit_id', NEW.unit_id,
            'quantity', purchase_item.quantity,
            'purchase_id', NEW.id,
            'purchase_item_id', purchase_item.id,
            'item_name', purchase_item.item_name,
            'item_code', purchase_item.item_code
          )
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
        created_by
      ) VALUES (
        purchase_item.item_id,
        NEW.unit_id, -- Origem: unidade que fez a compra (representa fornecedor)
        NEW.unit_id, -- Destino: estoque da unidade
        purchase_item.quantity,
        'purchase',
        'Purchase #' || NEW.id::text,
        format('Item %s (%s) adicionado ao estoque via compra finalizada. Quantidade: %s', 
               purchase_item.item_name, 
               purchase_item.item_code, 
               purchase_item.quantity),
        user_id_val
      );

      -- Log da movimentação
      INSERT INTO audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        new_values
      ) VALUES (
        user_id_val,
        'MOVEMENT_CREATED_FROM_PURCHASE',
        'movements',
        NULL, -- Será preenchido pelo trigger de movements
        jsonb_build_object(
          'item_id', purchase_item.item_id,
          'unit_id', NEW.unit_id,
          'quantity', purchase_item.quantity,
          'type', 'purchase',
          'purchase_id', NEW.id,
          'purchase_item_id', purchase_item.id,
          'item_name', purchase_item.item_name,
          'item_code', purchase_item.item_code
        )
      );

    END LOOP;

    -- Log geral da finalização da compra
    INSERT INTO audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      old_values,
      new_values
    ) VALUES (
      user_id_val,
      'PURCHASE_FINALIZED_STOCK_UPDATED',
      'purchases',
      NEW.id::text,
      jsonb_build_object(
        'old_status', OLD.status,
        'total_value', NEW.total_value
      ),
      jsonb_build_object(
        'new_status', NEW.status,
        'unit_id', NEW.unit_id,
        'total_items_processed', (
          SELECT COUNT(*) 
          FROM purchase_items 
          WHERE purchase_id = NEW.id
        ),
        'finalized_at', now()
      )
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS process_purchase_finalization ON purchases;

-- Criar trigger para processar compras finalizadas
CREATE TRIGGER process_purchase_finalization
  AFTER UPDATE ON purchases
  FOR EACH ROW
  WHEN (OLD.status != 'finalizado' AND NEW.status = 'finalizado')
  EXECUTE FUNCTION process_finalized_purchase();

-- Função para verificar se uma compra pode ser finalizada
CREATE OR REPLACE FUNCTION can_finalize_purchase(purchase_id uuid)
RETURNS boolean AS $$
DECLARE
  purchase_record RECORD;
  item_count integer;
BEGIN
  -- Buscar informações da compra
  SELECT * INTO purchase_record
  FROM purchases
  WHERE id = purchase_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Verificar se a compra já está finalizada
  IF purchase_record.status = 'finalizado' THEN
    RETURN false;
  END IF;

  -- Verificar se há itens na compra
  SELECT COUNT(*) INTO item_count
  FROM purchase_items
  WHERE purchase_id = purchase_id;

  IF item_count = 0 THEN
    RETURN false;
  END IF;

  -- Verificar se todos os itens têm quantidade válida
  IF EXISTS (
    SELECT 1 
    FROM purchase_items 
    WHERE purchase_id = purchase_id 
    AND (quantity IS NULL OR quantity <= 0)
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter resumo de uma compra antes de finalizar
CREATE OR REPLACE FUNCTION get_purchase_summary(purchase_id uuid)
RETURNS TABLE (
  purchase_status text,
  unit_name text,
  total_items bigint,
  total_value numeric,
  items_detail jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.status,
    u.name as unit_name,
    COUNT(pi.id) as total_items,
    p.total_value,
    jsonb_agg(
      jsonb_build_object(
        'item_name', i.name,
        'item_code', i.code,
        'quantity', pi.quantity,
        'unit_price', pi.unit_price,
        'total_price', pi.total_price
      )
    ) as items_detail
  FROM purchases p
  JOIN units u ON u.id = p.unit_id
  LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
  LEFT JOIN items i ON i.id = pi.item_id
  WHERE p.id = purchase_id
  GROUP BY p.id, p.status, u.name, p.total_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários sobre as funções
COMMENT ON FUNCTION process_finalized_purchase() IS 
'Processa automaticamente compras finalizadas, adicionando itens ao estoque e criando movimentações';

COMMENT ON FUNCTION can_finalize_purchase(uuid) IS 
'Verifica se uma compra pode ser finalizada (tem itens válidos e não está já finalizada)';

COMMENT ON FUNCTION get_purchase_summary(uuid) IS 
'Retorna resumo detalhado de uma compra para visualização antes da finalização';

-- Atualizar constraint de status para garantir que 'finalizado' seja imutável
-- (Uma vez finalizada, a compra não pode mudar de status)
CREATE OR REPLACE FUNCTION prevent_unfinalizing_purchase()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'finalizado' AND NEW.status != 'finalizado' THEN
    RAISE EXCEPTION 'Cannot change status of a finalized purchase. Purchase ID: %', OLD.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para prevenir "desfinalização" de compras
DROP TRIGGER IF EXISTS prevent_purchase_unfinalization ON purchases;
CREATE TRIGGER prevent_purchase_unfinalization
  BEFORE UPDATE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION prevent_unfinalizing_purchase();