/*
  # Criar Estoque CD e Tabela Em Rota

  1. Nova Tabela cd_stock
    - Estoque específico dos Centros de Distribuição
    - Apenas Admin e Almoxarife podem ver/gerenciar
  
  2. Nova Tabela em_rota
    - Itens que saíram do CD e estão a caminho das unidades
    - Controle de itens em trânsito
  
  3. Atualizar Políticas
    - Separar permissões entre estoque normal e estoque CD
    - Controlar acesso conforme perfil do usuário
*/

-- Criar tabela de estoque do CD
CREATE TABLE IF NOT EXISTS cd_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  cd_unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  quantity numeric DEFAULT 0 NOT NULL,
  min_quantity numeric DEFAULT NULL,
  max_quantity numeric DEFAULT NULL,
  location text DEFAULT 'Estoque CD',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(item_id, cd_unit_id)
);

-- Criar tabela em_rota (itens em trânsito)
CREATE TABLE IF NOT EXISTS em_rota (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  from_cd_unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  to_unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  quantity numeric NOT NULL,
  request_id uuid REFERENCES requests(id) ON DELETE SET NULL,
  status text DEFAULT 'em_transito' CHECK (status IN ('em_transito', 'entregue')),
  sent_at timestamptz DEFAULT now(),
  delivered_at timestamptz DEFAULT NULL,
  notes text DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_cd_stock_item_id ON cd_stock(item_id);
CREATE INDEX IF NOT EXISTS idx_cd_stock_cd_unit_id ON cd_stock(cd_unit_id);
CREATE INDEX IF NOT EXISTS idx_em_rota_request_id ON em_rota(request_id);
CREATE INDEX IF NOT EXISTS idx_em_rota_status ON em_rota(status);
CREATE INDEX IF NOT EXISTS idx_em_rota_from_cd_unit_id ON em_rota(from_cd_unit_id);
CREATE INDEX IF NOT EXISTS idx_em_rota_to_unit_id ON em_rota(to_unit_id);

-- RLS para cd_stock
ALTER TABLE cd_stock ENABLE ROW LEVEL SECURITY;

-- Apenas Admin e Almoxarife podem gerenciar estoque CD
CREATE POLICY "Admins and almoxarife can manage CD stock"
  ON cd_stock
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

-- RLS para em_rota
ALTER TABLE em_rota ENABLE ROW LEVEL SECURITY;

-- Todos podem ler em_rota, mas apenas admin e almoxarife podem gerenciar
CREATE POLICY "All authenticated users can read em_rota"
  ON em_rota
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and almoxarife can manage em_rota"
  ON em_rota
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

-- Triggers para auditoria
CREATE TRIGGER audit_trigger_cd_stock
  AFTER INSERT OR UPDATE OR DELETE ON cd_stock
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_trigger_em_rota
  AFTER INSERT OR UPDATE OR DELETE ON em_rota
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- Triggers para updated_at
CREATE TRIGGER update_cd_stock_updated_at
  BEFORE UPDATE ON cd_stock
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para processar pedidos enviados (CD -> Em Rota)
CREATE OR REPLACE FUNCTION process_request_sent()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando status muda para 'enviado', mover itens do CD para em_rota
  IF OLD.status != 'enviado' AND NEW.status = 'enviado' THEN
    -- Inserir itens na tabela em_rota
    INSERT INTO em_rota (item_id, from_cd_unit_id, to_unit_id, quantity, request_id, notes)
    SELECT 
      ri.item_id,
      NEW.cd_unit_id,
      NEW.requesting_unit_id,
      ri.quantity_approved,
      NEW.id,
      'Enviado automaticamente via pedido #' || NEW.id
    FROM request_items ri
    WHERE ri.request_id = NEW.id
    AND ri.quantity_approved > 0;

    -- Subtrair do estoque do CD
    UPDATE cd_stock 
    SET quantity = quantity - ri.quantity_approved
    FROM request_items ri
    WHERE cd_stock.item_id = ri.item_id
    AND cd_stock.cd_unit_id = NEW.cd_unit_id
    AND ri.request_id = NEW.id
    AND ri.quantity_approved > 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para processar pedidos recebidos (Em Rota -> Estoque Unidade)
CREATE OR REPLACE FUNCTION process_request_received()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando status muda para 'recebido', mover itens de em_rota para estoque da unidade
  IF OLD.status != 'recebido' AND NEW.status = 'recebido' THEN
    -- Mover de em_rota para estoque da unidade
    INSERT INTO stock (item_id, unit_id, quantity, location)
    SELECT 
      er.item_id,
      er.to_unit_id,
      er.quantity,
      'Estoque Geral'
    FROM em_rota er
    WHERE er.request_id = NEW.id
    AND er.status = 'em_transito'
    ON CONFLICT (item_id, unit_id)
    DO UPDATE SET quantity = stock.quantity + EXCLUDED.quantity;

    -- Marcar como entregue na tabela em_rota
    UPDATE em_rota 
    SET status = 'entregue', delivered_at = now()
    WHERE request_id = NEW.id
    AND status = 'em_transito';

    -- Criar movimentações
    INSERT INTO movements (item_id, from_unit_id, to_unit_id, quantity, type, reference, notes, created_by)
    SELECT 
      er.item_id,
      er.from_cd_unit_id,
      er.to_unit_id,
      er.quantity,
      'transfer',
      'Pedido #' || NEW.id,
      'Transferência automática via pedido interno',
      auth.uid()
    FROM em_rota er
    WHERE er.request_id = NEW.id
    AND er.status = 'entregue';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers
DROP TRIGGER IF EXISTS process_request_sent ON requests;
CREATE TRIGGER process_request_sent
  AFTER UPDATE ON requests
  FOR EACH ROW
  WHEN (OLD.status != 'enviado' AND NEW.status = 'enviado')
  EXECUTE FUNCTION process_request_sent();

DROP TRIGGER IF EXISTS process_request_received ON requests;
CREATE TRIGGER process_request_received
  AFTER UPDATE ON requests
  FOR EACH ROW
  WHEN (OLD.status != 'recebido' AND NEW.status = 'recebido')
  EXECUTE FUNCTION process_request_received();