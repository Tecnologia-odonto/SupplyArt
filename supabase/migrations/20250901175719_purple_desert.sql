/*
  # Sistema de Cotações de Compras

  1. New Tables
    - `quotations`
      - `id` (uuid, primary key)
      - `purchase_id` (uuid, foreign key to purchases)
      - `title` (text)
      - `description` (text, optional)
      - `status` (text, default 'rascunho')
      - `deadline` (date, optional)
      - `created_by` (uuid, foreign key to profiles)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `quotation_items`
      - `id` (uuid, primary key)
      - `quotation_id` (uuid, foreign key to quotations)
      - `item_id` (uuid, foreign key to items)
      - `quantity` (numeric)
      - `created_at` (timestamp)
    
    - `quotation_responses`
      - `id` (uuid, primary key)
      - `quotation_id` (uuid, foreign key to quotations)
      - `supplier_id` (uuid, foreign key to suppliers)
      - `response_date` (date)
      - `notes` (text, optional)
      - `created_at` (timestamp)
    
    - `quotation_item_prices`
      - `id` (uuid, primary key)
      - `quotation_response_id` (uuid, foreign key to quotation_responses)
      - `item_id` (uuid, foreign key to items)
      - `unit_price` (numeric)
      - `total_price` (numeric)
      - `delivery_time_days` (integer, optional)
      - `notes` (text, optional)
      - `selected` (boolean, default false)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users based on roles
    - Admins and gestors can manage all quotations
    - Operador-almoxarife can manage quotations
    - Other roles have read access

  3. Indexes
    - Performance indexes on foreign keys and frequently queried columns

  4. Triggers
    - Audit logging for all tables
    - Updated_at triggers where applicable
*/

-- Create quotations table
CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviada', 'em_analise', 'finalizada', 'cancelada')),
  deadline date,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create quotation_items table
CREATE TABLE IF NOT EXISTS quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity numeric NOT NULL CHECK (quantity > 0),
  created_at timestamptz DEFAULT now(),
  UNIQUE(quotation_id, item_id)
);

-- Create quotation_responses table
CREATE TABLE IF NOT EXISTS quotation_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  response_date date DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(quotation_id, supplier_id)
);

-- Create quotation_item_prices table
CREATE TABLE IF NOT EXISTS quotation_item_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_response_id uuid NOT NULL REFERENCES quotation_responses(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  total_price numeric NOT NULL CHECK (total_price >= 0),
  delivery_time_days integer CHECK (delivery_time_days >= 0),
  notes text,
  selected boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(quotation_response_id, item_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quotations_purchase_id ON quotations(purchase_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_created_by ON quotations(created_by);
CREATE INDEX IF NOT EXISTS idx_quotations_deadline ON quotations(deadline);

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_item_id ON quotation_items(item_id);

CREATE INDEX IF NOT EXISTS idx_quotation_responses_quotation_id ON quotation_responses(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_responses_supplier_id ON quotation_responses(supplier_id);

CREATE INDEX IF NOT EXISTS idx_quotation_item_prices_response_id ON quotation_item_prices(quotation_response_id);
CREATE INDEX IF NOT EXISTS idx_quotation_item_prices_item_id ON quotation_item_prices(item_id);
CREATE INDEX IF NOT EXISTS idx_quotation_item_prices_selected ON quotation_item_prices(selected);

-- Enable RLS
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_item_prices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quotations
CREATE POLICY "Users can read quotations based on role"
  ON quotations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN purchases pur ON pur.id = quotations.purchase_id
      WHERE p.id = uid() 
      AND (
        p.role IN ('admin', 'gestor', 'operador-almoxarife') 
        OR (p.role = 'operador-financeiro' AND p.unit_id = pur.unit_id)
        OR (p.role = 'operador-administrativo' AND p.unit_id = pur.unit_id)
      )
    )
  );

CREATE POLICY "Users can manage quotations based on role"
  ON quotations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN purchases pur ON pur.id = quotations.purchase_id
      WHERE p.id = uid() 
      AND (
        p.role IN ('admin', 'gestor', 'operador-almoxarife')
        OR (p.role = 'operador-financeiro' AND p.unit_id = pur.unit_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN purchases pur ON pur.id = quotations.purchase_id
      WHERE p.id = uid() 
      AND (
        p.role IN ('admin', 'gestor', 'operador-almoxarife')
        OR (p.role = 'operador-financeiro' AND p.unit_id = pur.unit_id)
      )
    )
  );

-- RLS Policies for quotation_items
CREATE POLICY "Users can read quotation items through quotations"
  ON quotation_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN profiles p ON p.id = uid()
      JOIN purchases pur ON pur.id = q.purchase_id
      WHERE q.id = quotation_items.quotation_id
      AND (
        p.role IN ('admin', 'gestor', 'operador-almoxarife') 
        OR (p.role = 'operador-financeiro' AND p.unit_id = pur.unit_id)
        OR (p.role = 'operador-administrativo' AND p.unit_id = pur.unit_id)
      )
    )
  );

CREATE POLICY "Users can manage quotation items through quotations"
  ON quotation_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN profiles p ON p.id = uid()
      JOIN purchases pur ON pur.id = q.purchase_id
      WHERE q.id = quotation_items.quotation_id
      AND (
        p.role IN ('admin', 'gestor', 'operador-almoxarife')
        OR (p.role = 'operador-financeiro' AND p.unit_id = pur.unit_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN profiles p ON p.id = uid()
      JOIN purchases pur ON pur.id = q.purchase_id
      WHERE q.id = quotation_items.quotation_id
      AND (
        p.role IN ('admin', 'gestor', 'operador-almoxarife')
        OR (p.role = 'operador-financeiro' AND p.unit_id = pur.unit_id)
      )
    )
  );

-- RLS Policies for quotation_responses
CREATE POLICY "Users can read quotation responses through quotations"
  ON quotation_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN profiles p ON p.id = uid()
      JOIN purchases pur ON pur.id = q.purchase_id
      WHERE q.id = quotation_responses.quotation_id
      AND (
        p.role IN ('admin', 'gestor', 'operador-almoxarife') 
        OR (p.role = 'operador-financeiro' AND p.unit_id = pur.unit_id)
        OR (p.role = 'operador-administrativo' AND p.unit_id = pur.unit_id)
      )
    )
  );

CREATE POLICY "Users can manage quotation responses through quotations"
  ON quotation_responses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN profiles p ON p.id = uid()
      JOIN purchases pur ON pur.id = q.purchase_id
      WHERE q.id = quotation_responses.quotation_id
      AND (
        p.role IN ('admin', 'gestor', 'operador-almoxarife')
        OR (p.role = 'operador-financeiro' AND p.unit_id = pur.unit_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN profiles p ON p.id = uid()
      JOIN purchases pur ON pur.id = q.purchase_id
      WHERE q.id = quotation_responses.quotation_id
      AND (
        p.role IN ('admin', 'gestor', 'operador-almoxarife')
        OR (p.role = 'operador-financeiro' AND p.unit_id = pur.unit_id)
      )
    )
  );

-- RLS Policies for quotation_item_prices
CREATE POLICY "Users can read quotation item prices through quotations"
  ON quotation_item_prices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotation_responses qr
      JOIN quotations q ON q.id = qr.quotation_id
      JOIN profiles p ON p.id = uid()
      JOIN purchases pur ON pur.id = q.purchase_id
      WHERE qr.id = quotation_item_prices.quotation_response_id
      AND (
        p.role IN ('admin', 'gestor', 'operador-almoxarife') 
        OR (p.role = 'operador-financeiro' AND p.unit_id = pur.unit_id)
        OR (p.role = 'operador-administrativo' AND p.unit_id = pur.unit_id)
      )
    )
  );

CREATE POLICY "Users can manage quotation item prices through quotations"
  ON quotation_item_prices
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotation_responses qr
      JOIN quotations q ON q.id = qr.quotation_id
      JOIN profiles p ON p.id = uid()
      JOIN purchases pur ON pur.id = q.purchase_id
      WHERE qr.id = quotation_item_prices.quotation_response_id
      AND (
        p.role IN ('admin', 'gestor', 'operador-almoxarife')
        OR (p.role = 'operador-financeiro' AND p.unit_id = pur.unit_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotation_responses qr
      JOIN quotations q ON q.id = qr.quotation_id
      JOIN profiles p ON p.id = uid()
      JOIN purchases pur ON pur.id = q.purchase_id
      WHERE qr.id = quotation_item_prices.quotation_response_id
      AND (
        p.role IN ('admin', 'gestor', 'operador-almoxarife')
        OR (p.role = 'operador-financeiro' AND p.unit_id = pur.unit_id)
      )
    )
  );

-- Add audit triggers
CREATE TRIGGER audit_trigger_quotations
  AFTER INSERT OR UPDATE OR DELETE ON quotations
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_trigger_quotation_items
  AFTER INSERT OR UPDATE OR DELETE ON quotation_items
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_trigger_quotation_responses
  AFTER INSERT OR UPDATE OR DELETE ON quotation_responses
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_trigger_quotation_item_prices
  AFTER INSERT OR UPDATE OR DELETE ON quotation_item_prices
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- Add updated_at triggers
CREATE TRIGGER update_quotations_updated_at
  BEFORE UPDATE ON quotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();