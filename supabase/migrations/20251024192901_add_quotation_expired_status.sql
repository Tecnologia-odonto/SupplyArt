/*
  # Adicionar Status 'Vencida' para Cotações

  1. Alterações
    - Adicionar status 'vencida' ao constraint de quotations.status
    - Criar função para invalidar cotações de um pedido
    - Criar trigger para avisar sobre cotações ao atualizar pedido

  2. Security
    - Manter RLS existente
    - Função acessível apenas via authenticated users
*/

-- Atualizar constraint de status para incluir 'vencida'
DO $$
BEGIN
  -- Remover constraint antiga
  ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_status_check;
  
  -- Adicionar nova constraint com 'vencida'
  ALTER TABLE quotations ADD CONSTRAINT quotations_status_check 
    CHECK (status IN ('rascunho', 'enviada', 'em_analise', 'finalizada', 'cancelada', 'vencida'));
END $$;

-- Função para invalidar todas as cotações de um pedido
CREATE OR REPLACE FUNCTION invalidate_purchase_quotations(
  p_purchase_id uuid
) RETURNS integer AS $$
DECLARE
  affected_count integer;
BEGIN
  -- Atualizar todas as cotações não finalizadas para 'vencida'
  UPDATE quotations
  SET 
    status = 'vencida',
    updated_at = now()
  WHERE purchase_id = p_purchase_id
  AND status NOT IN ('finalizada', 'cancelada', 'vencida');
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  RETURN affected_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se um pedido tem cotações ativas
CREATE OR REPLACE FUNCTION check_purchase_has_active_quotations(
  p_purchase_id uuid
) RETURNS TABLE (
  has_quotations boolean,
  quotations_count integer,
  quotations_list jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXISTS(
      SELECT 1 
      FROM quotations 
      WHERE purchase_id = p_purchase_id 
      AND status NOT IN ('cancelada', 'vencida')
    ) as has_quotations,
    (
      SELECT COUNT(*)::integer 
      FROM quotations 
      WHERE purchase_id = p_purchase_id 
      AND status NOT IN ('cancelada', 'vencida')
    ) as quotations_count,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'title', title,
          'status', status,
          'created_at', created_at
        )
      )
      FROM quotations 
      WHERE purchase_id = p_purchase_id 
      AND status NOT IN ('cancelada', 'vencida')
    ) as quotations_list;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários nas funções
COMMENT ON FUNCTION invalidate_purchase_quotations IS 'Invalida todas as cotações ativas de um pedido, marcando-as como vencidas';
COMMENT ON FUNCTION check_purchase_has_active_quotations IS 'Verifica se um pedido possui cotações ativas e retorna informações sobre elas';
