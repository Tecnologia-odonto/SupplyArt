/*
  # Atualizar políticas do estoque CD para operadores almoxarife

  1. Políticas
    - Operadores almoxarife podem gerenciar apenas o estoque do CD ao qual estão vinculados
    - Admins mantêm acesso total
    
  2. Segurança
    - RLS habilitado
    - Políticas baseadas na unidade vinculada do usuário
*/

-- Remover políticas existentes
DROP POLICY IF EXISTS "Admins and almoxarife can manage CD stock" ON cd_stock;

-- Criar novas políticas específicas
CREATE POLICY "Admins can manage all CD stock"
  ON cd_stock
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Almoxarife can manage their CD stock"
  ON cd_stock
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operador-almoxarife'
      AND profiles.unit_id = cd_stock.cd_unit_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operador-almoxarife'
      AND profiles.unit_id = cd_stock.cd_unit_id
    )
  );

-- Política de leitura para outros usuários (se necessário)
CREATE POLICY "Users can read CD stock for requests"
  ON cd_stock
  FOR SELECT
  TO authenticated
  USING (true);