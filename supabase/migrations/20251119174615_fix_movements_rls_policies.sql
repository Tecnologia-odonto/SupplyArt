/*
  # Corrigir Políticas RLS da Tabela Movements

  ## Problema
  - Operadores almoxarifes, administrativos não conseguem criar movimentações
  - Erro RLS ao marcar itens como entregues no módulo Em Rota
  
  ## Solução
  - Atualizar políticas para permitir que mais roles possam criar movimentações
  - Manter controle de acesso adequado
  
  ## Políticas
  - SELECT: Admin, Gestor, Op. Almoxarife, Op. Administrativo, Op. Financeiro
  - INSERT: Admin, Gestor, Op. Almoxarife, Op. Administrativo
  - UPDATE/DELETE: Apenas Admin
*/

-- Remover políticas antigas
DROP POLICY IF EXISTS "Admins and gestors can manage movements" ON movements;
DROP POLICY IF EXISTS "Admins and gestors can read all movements" ON movements;

-- Política de SELECT: todos os operadores podem ver movimentações
CREATE POLICY "Users can view movements"
  ON movements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'gestor', 'operador-almoxarife', 'operador-administrativo', 'operador-financeiro')
    )
  );

-- Política de INSERT: operadores que gerenciam estoque podem criar movimentações
CREATE POLICY "Stock managers can create movements"
  ON movements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'gestor', 'operador-almoxarife', 'operador-administrativo')
    )
    AND created_by = auth.uid()
  );

-- Política de UPDATE: apenas admin pode atualizar
CREATE POLICY "Only admins can update movements"
  ON movements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Política de DELETE: apenas admin pode deletar
CREATE POLICY "Only admins can delete movements"
  ON movements
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );