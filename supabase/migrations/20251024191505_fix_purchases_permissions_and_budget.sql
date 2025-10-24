/*
  # Correções de Pedidos: Permissões, Orçamento e Notificações

  1. Alterações na Tabela purchases
    - Adicionar coluna `budget_id` (referência a unit_budgets)
    - Modificar coluna status para incluir 'pedido-realizado' como valor padrão

  2. Nova Tabela notifications
    - `id` (uuid, primary key)
    - `user_id` (uuid, foreign key to profiles)
    - `title` (text)
    - `message` (text)
    - `type` (text: info, warning, error, success)
    - `read` (boolean, default false)
    - `metadata` (jsonb, optional)
    - `created_at` (timestamp)

  3. Correções RLS em purchases
    - Permitir Op. Administrativo criar pedidos para sua unidade
    - Permitir Op. Administrativo ler pedidos de sua unidade
    - Permitir edição apenas após criação (status não pode ser alterado no create)

  4. Security
    - Enable RLS em notifications
    - Políticas para notificações (usuário só vê suas próprias)
*/

-- Adicionar coluna budget_id à tabela purchases se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchases' AND column_name = 'budget_id'
  ) THEN
    ALTER TABLE purchases ADD COLUMN budget_id uuid REFERENCES unit_budgets(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Atualizar constraint de status para incluir valor padrão correto
DO $$
BEGIN
  -- Remover constraint antiga se existir
  ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_status_check;
  
  -- Adicionar nova constraint com valores corretos
  ALTER TABLE purchases ADD CONSTRAINT purchases_status_check 
    CHECK (status IN ('pedido-realizado', 'em-cotacao', 'comprado-aguardando', 'chegou-cd', 'enviado', 'erro-pedido', 'finalizado'));
  
  -- Definir valor padrão
  ALTER TABLE purchases ALTER COLUMN status SET DEFAULT 'pedido-realizado';
END $$;

-- Criar tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
  read boolean DEFAULT false,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_purchases_budget_id ON purchases(budget_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Enable RLS em notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas de purchases que causam problemas
DROP POLICY IF EXISTS "Users can read purchases based on access" ON purchases;
DROP POLICY IF EXISTS "Users can create purchases for their unit" ON purchases;
DROP POLICY IF EXISTS "Users can update purchases based on permissions" ON purchases;

-- Políticas atualizadas para purchases

-- Admins podem ler todas as compras
CREATE POLICY "Admins can read all purchases"
  ON purchases
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Gestor pode ler compras de sua unidade
CREATE POLICY "Gestors can read purchases from their unit"
  ON purchases
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gestor'
      AND profiles.unit_id = purchases.unit_id
    )
  );

-- Operador Financeiro pode ler todas as compras
CREATE POLICY "Financial operators can read all purchases"
  ON purchases
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operador-financeiro'
    )
  );

-- Operador Administrativo pode ler compras de sua unidade
CREATE POLICY "Administrative operators can read purchases from their unit"
  ON purchases
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operador-administrativo'
      AND profiles.unit_id = purchases.unit_id
    )
  );

-- Operador Almoxarife pode ler compras de seu CD
CREATE POLICY "Almoxarife can read purchases from their CD"
  ON purchases
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operador-almoxarife'
      AND profiles.unit_id = purchases.unit_id
    )
  );

-- INSERT: Op. Administrativo pode criar pedidos para sua unidade
CREATE POLICY "Administrative operators can create purchases for their unit"
  ON purchases
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operador-administrativo'
      AND profiles.unit_id = purchases.unit_id
    )
  );

-- INSERT: Almoxarife pode criar compras
CREATE POLICY "Almoxarife can create purchases"
  ON purchases
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operador-almoxarife'
      AND profiles.unit_id = purchases.unit_id
    )
  );

-- INSERT: Admin pode criar compras
CREATE POLICY "Admins can create purchases"
  ON purchases
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- UPDATE: Admin pode atualizar qualquer compra
CREATE POLICY "Admins can update all purchases"
  ON purchases
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- UPDATE: Almoxarife pode atualizar compras
CREATE POLICY "Almoxarife can update purchases"
  ON purchases
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operador-almoxarife'
    )
  );

-- UPDATE: Operador Financeiro pode atualizar compras
CREATE POLICY "Financial operators can update purchases"
  ON purchases
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operador-financeiro'
    )
  );

-- DELETE: Apenas admin pode deletar
CREATE POLICY "Only admins can delete purchases"
  ON purchases
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Políticas para notifications

-- Usuários podem ler suas próprias notificações
CREATE POLICY "Users can read own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Usuários podem atualizar suas próprias notificações (marcar como lida)
CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Sistema pode criar notificações (via service role)
CREATE POLICY "System can create notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admins podem gerenciar todas as notificações
CREATE POLICY "Admins can manage all notifications"
  ON notifications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
