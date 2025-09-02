/*
  # Criar tabelas para módulo de Cotações de Compras

  1. Novas Tabelas
    - `quotations`
      - `id` (uuid, primary key)
      - `purchase_id` (uuid, foreign key para purchases)
      - `title` (text, título da cotação)
      - `description` (text, descrição opcional)
      - `status` (text, status da cotação)
      - `deadline` (date, prazo para resposta)
      - `created_by` (uuid, foreign key para profiles)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `quotation_items`
      - `id` (uuid, primary key)
      - `quotation_id` (uuid, foreign key para quotations)
      - `item_id` (uuid, foreign key para items)
      - `quantity` (numeric, quantidade solicitada)
      - `created_at` (timestamp)
    
    - `quotation_responses`
      - `id` (uuid, primary key)
      - `quotation_id` (uuid, foreign key para quotations)
      - `supplier_id` (uuid, foreign key para suppliers)
      - `item_id` (uuid, foreign key para items)
      - `unit_price` (numeric, preço unitário oferecido)
      - `total_price` (numeric, preço total calculado)
      - `delivery_time` (integer, prazo de entrega em dias)
      - `notes` (text, observações do fornecedor)
      - `is_selected` (boolean, se foi escolhido)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `price_history`
      - `id` (uuid, primary key)
      - `item_id` (uuid, foreign key para items)
      - `supplier_id` (uuid, foreign key para suppliers)
      - `unit_price` (numeric, preço praticado)
      - `purchase_id` (uuid, foreign key para purchases)
      - `quotation_id` (uuid, foreign key para quotations)
      - `purchase_date` (date, data da compra)
      - `created_at` (timestamp)

  2. Segurança
    - Habilitar RLS em todas as tabelas
    - Políticas baseadas em permissões de usuário
    - Apenas usuários com permissão de compras podem gerenciar cotações

  3. Índices
    - Índices para melhor performance nas consultas
*/

-- Tabela principal de cotações
CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid REFERENCES purchases(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviada', 'em_analise', 'finalizada', 'cancelada')),
  deadline date,
  created_by uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de itens da cotação
CREATE TABLE IF NOT EXISTS quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid REFERENCES quotations(id) ON DELETE CASCADE,
  item_id uuid REFERENCES items(id) ON DELETE CASCADE,
  quantity numeric NOT NULL CHECK (quantity > 0),
  created_at timestamptz DEFAULT now()
);

-- Tabela de respostas dos fornecedores
CREATE TABLE IF NOT EXISTS quotation_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid REFERENCES quotations(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE CASCADE,
  item_id uuid REFERENCES items(id) ON DELETE CASCADE,
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  total_price numeric GENERATED ALWAYS AS (unit_price * (SELECT quantity FROM quotation_items WHERE quotation_id = quotation_responses.quotation_id AND item_id = quotation_responses.item_id)) STORED,
  delivery_time integer CHECK (delivery_time >= 0),
  notes text,
  is_selected boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de histórico de preços
CREATE TABLE IF NOT EXISTS price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES items(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE CASCADE,
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  purchase_id uuid REFERENCES purchases(id) ON DELETE SET NULL,
  quotation_id uuid REFERENCES quotations(id) ON DELETE SET NULL,
  purchase_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- Políticas para quotations
CREATE POLICY "Users can manage quotations based on purchase permissions"
  ON quotations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM purchases p
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE p.id = quotations.purchase_id
      AND (
        pr.role = ANY(ARRAY['admin', 'operador-almoxarife'])
        OR (pr.role = 'gestor' AND pr.unit_id = p.unit_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchases p
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE p.id = quotations.purchase_id
      AND (
        pr.role = ANY(ARRAY['admin', 'operador-almoxarife'])
        OR (pr.role = 'gestor' AND pr.unit_id = p.unit_id)
      )
    )
  );

-- Políticas para quotation_items
CREATE POLICY "Users can manage quotation items through quotations"
  ON quotation_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN purchases p ON p.id = q.purchase_id
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE q.id = quotation_items.quotation_id
      AND (
        pr.role = ANY(ARRAY['admin', 'operador-almoxarife'])
        OR (pr.role = 'gestor' AND pr.unit_id = p.unit_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN purchases p ON p.id = q.purchase_id
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE q.id = quotation_items.quotation_id
      AND (
        pr.role = ANY(ARRAY['admin', 'operador-almoxarife'])
        OR (pr.role = 'gestor' AND pr.unit_id = p.unit_id)
      )
    )
  );

-- Políticas para quotation_responses
CREATE POLICY "Users can manage quotation responses through quotations"
  ON quotation_responses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN purchases p ON p.id = q.purchase_id
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE q.id = quotation_responses.quotation_id
      AND (
        pr.role = ANY(ARRAY['admin', 'operador-almoxarife'])
        OR (pr.role = 'gestor' AND pr.unit_id = p.unit_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN purchases p ON p.id = q.purchase_id
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE q.id = quotation_responses.quotation_id
      AND (
        pr.role = ANY(ARRAY['admin', 'operador-almoxarife'])
        OR (pr.role = 'gestor' AND pr.unit_id = p.unit_id)
      )
    )
  );

-- Políticas para price_history
CREATE POLICY "Users can read price history"
  ON price_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = ANY(ARRAY['admin', 'gestor', 'operador-almoxarife', 'operador-financeiro'])
    )
  );

CREATE POLICY "Users can insert price history"
  ON price_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = ANY(ARRAY['admin', 'operador-almoxarife'])
    )
  );

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_quotations_purchase_id ON quotations(purchase_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_created_by ON quotations(created_by);
CREATE INDEX IF NOT EXISTS idx_quotations_deadline ON quotations(deadline);

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_item_id ON quotation_items(item_id);

CREATE INDEX IF NOT EXISTS idx_quotation_responses_quotation_id ON quotation_responses(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_responses_supplier_id ON quotation_responses(supplier_id);
CREATE INDEX IF NOT EXISTS idx_quotation_responses_item_id ON quotation_responses(item_id);
CREATE INDEX IF NOT EXISTS idx_quotation_responses_is_selected ON quotation_responses(is_selected);

CREATE INDEX IF NOT EXISTS idx_price_history_item_id ON price_history(item_id);
CREATE INDEX IF NOT EXISTS idx_price_history_supplier_id ON price_history(supplier_id);
CREATE INDEX IF NOT EXISTS idx_price_history_purchase_date ON price_history(purchase_date);

-- Triggers para updated_at
CREATE TRIGGER update_quotations_updated_at
  BEFORE UPDATE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotation_responses_updated_at
  BEFORE UPDATE ON quotation_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers de auditoria
CREATE TRIGGER audit_trigger_quotations
  AFTER INSERT OR UPDATE OR DELETE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_trigger_quotation_items
  AFTER INSERT OR UPDATE OR DELETE ON quotation_items
  FOR EACH ROW
  EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_trigger_quotation_responses
  AFTER INSERT OR UPDATE OR DELETE ON quotation_responses
  FOR EACH ROW
  EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_trigger_price_history
  AFTER INSERT OR UPDATE OR DELETE ON price_history
  FOR EACH ROW
  EXECUTE FUNCTION create_audit_log();

-- Constraint para evitar duplicatas
ALTER TABLE quotation_items ADD CONSTRAINT unique_quotation_item 
  UNIQUE (quotation_id, item_id);

ALTER TABLE quotation_responses ADD CONSTRAINT unique_quotation_supplier_item 
  UNIQUE (quotation_id, supplier_id, item_id);