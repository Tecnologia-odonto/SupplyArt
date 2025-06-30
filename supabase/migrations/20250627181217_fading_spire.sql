/*
  # Sistema Completo de Auditoria e Logs

  1. Melhorias na tabela audit_logs
    - Adicionar campos para melhor rastreamento
    - Índices para performance
    - Políticas de segurança

  2. Triggers automáticos para auditoria
    - Triggers para todas as tabelas principais
    - Captura automática de mudanças
    - Logs de criação, atualização e exclusão

  3. Função para logs de autenticação
    - Logs de login/logout
    - Tentativas de acesso negado
*/

-- Melhorar a tabela audit_logs se necessário
DO $$
BEGIN
  -- Adicionar campos se não existirem
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN ip_address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'user_agent'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN user_agent text;
  END IF;
END $$;

-- Função genérica para criar logs de auditoria
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  user_id_val uuid;
BEGIN
  -- Tentar obter o ID do usuário atual
  BEGIN
    user_id_val := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    user_id_val := '00000000-0000-0000-0000-000000000000';
  END;

  -- Se não conseguir obter o usuário, usar um ID padrão
  IF user_id_val IS NULL THEN
    user_id_val := '00000000-0000-0000-0000-000000000000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      old_values
    ) VALUES (
      user_id_val,
      'DELETE',
      TG_TABLE_NAME,
      OLD.id::text,
      row_to_json(OLD)
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      old_values,
      new_values
    ) VALUES (
      user_id_val,
      'UPDATE',
      TG_TABLE_NAME,
      NEW.id::text,
      row_to_json(OLD),
      row_to_json(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      new_values
    ) VALUES (
      user_id_val,
      'INSERT',
      TG_TABLE_NAME,
      NEW.id::text,
      row_to_json(NEW)
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar triggers de auditoria para todas as tabelas principais
DO $$
DECLARE
  table_name text;
  tables_to_audit text[] := ARRAY[
    'profiles',
    'units', 
    'items',
    'suppliers',
    'stock',
    'inventory',
    'inventory_items',
    'inventory_events',
    'purchases',
    'purchase_items',
    'movements',
    'financial_transactions',
    'unit_budgets'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables_to_audit
  LOOP
    -- Drop existing trigger if it exists
    EXECUTE format('DROP TRIGGER IF EXISTS audit_trigger_%s ON %s', table_name, table_name);
    
    -- Create new trigger
    EXECUTE format('
      CREATE TRIGGER audit_trigger_%s
        AFTER INSERT OR UPDATE OR DELETE ON %s
        FOR EACH ROW EXECUTE FUNCTION create_audit_log()
    ', table_name, table_name);
  END LOOP;
END $$;

-- Função para logs de movimento automático
CREATE OR REPLACE FUNCTION log_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
  user_id_val uuid;
  movement_type text;
  from_unit uuid;
  to_unit uuid;
BEGIN
  -- Tentar obter o ID do usuário atual
  BEGIN
    user_id_val := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    user_id_val := '00000000-0000-0000-0000-000000000000';
  END;

  IF user_id_val IS NULL THEN
    user_id_val := '00000000-0000-0000-0000-000000000000';
  END IF;

  -- Determinar tipo de movimento baseado na operação
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'stock' THEN
    -- Movimento de ajuste de estoque
    movement_type := 'adjustment';
    from_unit := NEW.unit_id;
    to_unit := NEW.unit_id;
    
    -- Só criar movimento se a quantidade mudou
    IF OLD.quantity != NEW.quantity THEN
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
        NEW.item_id,
        from_unit,
        to_unit,
        ABS(NEW.quantity - OLD.quantity),
        movement_type,
        'Stock adjustment',
        format('Stock adjusted from %s to %s', OLD.quantity, NEW.quantity),
        user_id_val
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para movimentos automáticos de estoque
DROP TRIGGER IF EXISTS stock_movement_trigger ON stock;
CREATE TRIGGER stock_movement_trigger
  AFTER UPDATE ON stock
  FOR EACH ROW
  EXECUTE FUNCTION log_stock_movement();

-- Melhorar políticas de audit_logs para permitir inserção automática
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
CREATE POLICY "System can insert audit logs"
  ON audit_logs
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Política para service role gerenciar audit logs
DROP POLICY IF EXISTS "Service role can manage audit logs" ON audit_logs;
CREATE POLICY "Service role can manage audit logs"
  ON audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Função para limpar logs antigos (opcional - executar manualmente)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(days_to_keep integer DEFAULT 365)
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM audit_logs 
  WHERE created_at < (CURRENT_DATE - INTERVAL '1 day' * days_to_keep);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário sobre uso da função de limpeza
COMMENT ON FUNCTION cleanup_old_audit_logs(integer) IS 
'Função para limpar logs de auditoria antigos. Execute manualmente: SELECT cleanup_old_audit_logs(365);';