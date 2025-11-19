/*
  # Melhorias na Tabela de Notificações

  ## Alterações
  
  1. Adicionar colunas novas se não existirem:
    - `reference_id` (uuid) - ID do item/pedido/etc relacionado
    - `reference_type` (text) - Tipo de referência (stock, cd_stock, request, etc)
    - `read_at` (timestamptz) - Data em que foi lida
    - `priority` (text) - Prioridade (normal, high, urgent)
    
  2. Atualizar tipo de notificação para incluir mais opções
  
  3. Manter compatibilidade com dados existentes
  
  ## Segurança
  
  - RLS já está habilitado
  - Políticas já existem
*/

-- Adicionar colunas novas se não existirem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'reference_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN reference_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'reference_type'
  ) THEN
    ALTER TABLE notifications ADD COLUMN reference_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'read_at'
  ) THEN
    ALTER TABLE notifications ADD COLUMN read_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'priority'
  ) THEN
    ALTER TABLE notifications ADD COLUMN priority text DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent'));
  END IF;
END $$;

-- Atualizar constraint do tipo para incluir mais tipos de notificação
DO $$
BEGIN
  -- Remover constraint antiga se existir
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  
  -- Adicionar nova constraint com todos os tipos
  ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
    CHECK (type IN (
      'info', 'warning', 'error', 'success',
      'stock_low', 'cd_stock_low', 'request_pending', 
      'request_approved', 'request_rejected', 'item_expired', 
      'maintenance_due', 'budget_low', 'budget_exceeded'
    ));
END $$;

-- Criar índice adicional para referências
CREATE INDEX IF NOT EXISTS idx_notifications_reference ON notifications(reference_type, reference_id);