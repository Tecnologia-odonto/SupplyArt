/*
  # Corrigir políticas de acesso ao estoque

  1. Políticas de Estoque
    - Permitir que gestores vejam e gerenciem estoque de sua unidade
    - Permitir que operadores administrativos vejam e gerenciem estoque de sua unidade
    - Manter acesso total para admins e operadores almoxarife

  2. Segurança
    - Atualizar RLS para incluir gestores com unidade específica
    - Garantir que operadores só vejam sua unidade
*/

-- Remover políticas existentes de estoque
DROP POLICY IF EXISTS "Users can manage stock based on permissions" ON stock;
DROP POLICY IF EXISTS "Users can read stock based on unit access" ON stock;

-- Criar novas políticas mais específicas
CREATE POLICY "Admins and almoxarife can manage all stock"
  ON stock
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'operador-almoxarife')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'operador-almoxarife')
    )
  );

CREATE POLICY "Gestors can manage stock of their unit"
  ON stock
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gestor'
      AND profiles.unit_id = stock.unit_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gestor'
      AND profiles.unit_id = stock.unit_id
    )
  );

CREATE POLICY "Administrative operators can manage stock of their unit"
  ON stock
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operador-administrativo'
      AND profiles.unit_id = stock.unit_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operador-administrativo'
      AND profiles.unit_id = stock.unit_id
    )
  );

-- Política para leitura geral (todos os usuários autenticados podem ler)
CREATE POLICY "All authenticated users can read stock"
  ON stock
  FOR SELECT
  TO authenticated
  USING (true);