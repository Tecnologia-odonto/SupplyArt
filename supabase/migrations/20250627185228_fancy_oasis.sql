/*
  # Atualizar tipos de movimentação e políticas de compras

  1. Alterações na tabela movements
    - Atualizar constraint para permitir apenas tipos específicos
    - Remover 'sale' e manter apenas 'transfer', 'adjustment', 'purchase'

  2. Políticas de compras baseadas em roles
    - Admin: pode ver todos
    - Gestor: todos da sua unidade  
    - Op. administrativo: somente seus pedidos
    - Op. almoxarife: pode ver todos
    - Op. financeiro: pode ver todos da sua unidade

  3. Melhorias nas políticas de movimentação
    - Apenas admins e gestores podem ver todas as movimentações
    - Outros roles têm acesso limitado
*/

-- Atualizar constraint de tipos de movimentação
ALTER TABLE movements DROP CONSTRAINT IF EXISTS movements_type_check;
ALTER TABLE movements ADD CONSTRAINT movements_type_check 
CHECK (type = ANY (ARRAY['transfer'::text, 'adjustment'::text, 'purchase'::text]));

-- Atualizar movimentações existentes que possam ter tipo 'sale'
UPDATE movements SET type = 'transfer' WHERE type = 'sale';

-- Remover políticas existentes de compras para recriar com as novas regras
DROP POLICY IF EXISTS "Users can read purchases based on access" ON purchases;
DROP POLICY IF EXISTS "Users can create purchases for their unit" ON purchases;
DROP POLICY IF EXISTS "Users can update purchases based on permissions" ON purchases;

-- Política de leitura de compras baseada em roles
CREATE POLICY "Users can read purchases based on role"
  ON purchases
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (
        -- Admin: pode ver todos
        p.role = 'admin' OR
        -- Gestor: todos da sua unidade
        (p.role = 'gestor' AND p.unit_id = purchases.unit_id) OR
        -- Op. administrativo: somente seus pedidos
        (p.role = 'operador-administrativo' AND purchases.requester_id = p.id) OR
        -- Op. almoxarife: pode ver todos
        p.role = 'operador-almoxarife' OR
        -- Op. financeiro: todos da sua unidade
        (p.role = 'operador-financeiro' AND p.unit_id = purchases.unit_id)
      )
    )
  );

-- Política de criação de compras
CREATE POLICY "Users can create purchases based on role"
  ON purchases
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'gestor', 'operador-administrativo')
      AND (
        -- Admin e gestor podem criar para qualquer unidade
        p.role IN ('admin', 'gestor') OR
        -- Op. administrativo só pode criar para sua unidade
        (p.role = 'operador-administrativo' AND p.unit_id = purchases.unit_id)
      )
    )
  );

-- Política de atualização de compras
CREATE POLICY "Users can update purchases based on role"
  ON purchases
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (
        -- Admin e gestor podem editar qualquer compra
        p.role IN ('admin', 'gestor') OR
        -- Op. financeiro pode editar informações financeiras
        p.role = 'operador-financeiro' OR
        -- Op. almoxarife pode editar status
        p.role = 'operador-almoxarife' OR
        -- Op. administrativo pode editar apenas suas próprias compras em status inicial
        (p.role = 'operador-administrativo' AND 
         purchases.requester_id = p.id AND 
         purchases.status = 'pedido-realizado')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'gestor') OR
        p.role = 'operador-financeiro' OR
        p.role = 'operador-almoxarife' OR
        (p.role = 'operador-administrativo' AND 
         purchases.requester_id = p.id AND 
         purchases.status = 'pedido-realizado')
      )
    )
  );

-- Comentários sobre as políticas
COMMENT ON POLICY "Users can read purchases based on role" ON purchases IS 
'Controla visibilidade de compras: Admin/Almoxarife veem todos, Gestor/Financeiro veem da unidade, Administrativo vê apenas seus pedidos';

COMMENT ON POLICY "Users can create purchases based on role" ON purchases IS 
'Permite criação de compras para Admin, Gestor e Operador Administrativo';

COMMENT ON POLICY "Users can update purchases based on role" ON purchases IS 
'Controla edição: Admin/Gestor editam tudo, Financeiro edita valores, Almoxarife edita status, Administrativo edita apenas seus pedidos iniciais';