/*
  # Sistema de Cotações de Compras

  1. New Tables
    - `quotations`
      - `id` (uuid, primary key)
      - `purchase_id` (uuid, foreign key to purchases)
      - `title` (text)
      - `description` (text, optional)
      - `status` (text, check constraint)
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
      - `item_id` (uuid, foreign key to items)
      - `unit_price` (numeric)
      - `delivery_time` (integer, optional)
      - `notes` (text, optional)
      - `is_selected` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `price_history`
      - `id` (uuid, primary key)
      - `item_id` (uuid, foreign key to items)
      - `supplier_id` (uuid, foreign key to suppliers)
      - `unit_price` (numeric)
      - `purchase_id` (uuid, foreign key to purchases, optional)
      - `quotation_id` (uuid, foreign key to quotations, optional)
      - `purchase_date` (date)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for each role:
      - Admin: full access
      - Gestor: access to quotations related to their unit
      - Operador Almoxarife: access to quotations from their CD
      - Operador Financeiro: read-only access to all quotations

  3. Indexes
    - Add indexes for foreign keys and commonly queried fields
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
  created_at timestamptz DEFAULT now()
);

-- Create quotation_responses table
CREATE TABLE IF NOT EXISTS quotation_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  delivery_time integer CHECK (delivery_time >= 0),
  notes text,
  is_selected boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create price_history table
CREATE TABLE IF NOT EXISTS price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  purchase_id uuid REFERENCES purchases(id) ON DELETE SET NULL,
  quotation_id uuid REFERENCES quotations(id) ON DELETE SET NULL,
  purchase_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quotations_purchase_id ON quotations(purchase_id);
CREATE INDEX IF NOT EXISTS idx_quotations_created_by ON quotations(created_by);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
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

-- Enable RLS
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quotations
CREATE POLICY "Admins can manage all quotations"
  ON quotations
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

CREATE POLICY "Gestors can manage quotations from their unit"
  ON quotations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN purchases pur ON pur.id = quotations.purchase_id
      WHERE p.id = auth.uid()
      AND p.role = 'gestor'
      AND p.unit_id = pur.unit_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN purchases pur ON pur.id = quotations.purchase_id
      WHERE p.id = auth.uid()
      AND p.role = 'gestor'
      AND p.unit_id = pur.unit_id
    )
  );

CREATE POLICY "Almoxarife can manage quotations from their CD"
  ON quotations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN purchases pur ON pur.id = quotations.purchase_id
      WHERE p.id = auth.uid()
      AND p.role = 'operador-almoxarife'
      AND p.unit_id = pur.unit_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN purchases pur ON pur.id = quotations.purchase_id
      WHERE p.id = auth.uid()
      AND p.role = 'operador-almoxarife'
      AND p.unit_id = pur.unit_id
    )
  );

CREATE POLICY "Financial operators can read all quotations"
  ON quotations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operador-financeiro'
    )
  );

-- RLS Policies for quotation_items
CREATE POLICY "Users can manage quotation items through quotations"
  ON quotation_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN profiles p ON p.id = auth.uid()
      WHERE q.id = quotation_items.quotation_id
      AND (
        p.role = 'admin'
        OR (p.role = 'gestor' AND EXISTS (
          SELECT 1 FROM purchases pur 
          WHERE pur.id = q.purchase_id AND pur.unit_id = p.unit_id
        ))
        OR (p.role = 'operador-almoxarife' AND EXISTS (
          SELECT 1 FROM purchases pur 
          WHERE pur.id = q.purchase_id AND pur.unit_id = p.unit_id
        ))
        OR p.role = 'operador-financeiro'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN profiles p ON p.id = auth.uid()
      WHERE q.id = quotation_items.quotation_id
      AND (
        p.role = 'admin'
        OR (p.role = 'gestor' AND EXISTS (
          SELECT 1 FROM purchases pur 
          WHERE pur.id = q.purchase_id AND pur.unit_id = p.unit_id
        ))
        OR (p.role = 'operador-almoxarife' AND EXISTS (
          SELECT 1 FROM purchases pur 
          WHERE pur.id = q.purchase_id AND pur.unit_id = p.unit_id
        ))
      )
    )
  );

-- RLS Policies for quotation_responses
CREATE POLICY "Users can manage quotation responses through quotations"
  ON quotation_responses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN profiles p ON p.id = auth.uid()
      WHERE q.id = quotation_responses.quotation_id
      AND (
        p.role = 'admin'
        OR (p.role = 'gestor' AND EXISTS (
          SELECT 1 FROM purchases pur 
          WHERE pur.id = q.purchase_id AND pur.unit_id = p.unit_id
        ))
        OR (p.role = 'operador-almoxarife' AND EXISTS (
          SELECT 1 FROM purchases pur 
          WHERE pur.id = q.purchase_id AND pur.unit_id = p.unit_id
        ))
        OR p.role = 'operador-financeiro'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN profiles p ON p.id = auth.uid()
      WHERE q.id = quotation_responses.quotation_id
      AND (
        p.role = 'admin'
        OR (p.role = 'gestor' AND EXISTS (
          SELECT 1 FROM purchases pur 
          WHERE pur.id = q.purchase_id AND pur.unit_id = p.unit_id
        ))
        OR (p.role = 'operador-almoxarife' AND EXISTS (
          SELECT 1 FROM purchases pur 
          WHERE pur.id = q.purchase_id AND pur.unit_id = p.unit_id
        ))
      )
    )
  );

-- RLS Policies for price_history
CREATE POLICY "Users can read price history"
  ON price_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'gestor', 'operador-financeiro', 'operador-almoxarife')
    )
  );

CREATE POLICY "Admins and almoxarife can manage price history"
  ON price_history
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

-- Add update triggers
CREATE TRIGGER update_quotations_updated_at
  BEFORE UPDATE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotation_responses_updated_at
  BEFORE UPDATE ON quotation_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add audit triggers
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