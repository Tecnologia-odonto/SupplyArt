/*
  # Sistema Completo de Cotações de Compras

  1. New Tables
    - `quotations`
      - `id` (uuid, primary key)
      - `purchase_id` (uuid, foreign key to purchases)
      - `title` (text)
      - `description` (text, nullable)
      - `status` (text, check constraint)
      - `deadline` (date, nullable)
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
      - `total_price` (numeric, computed)
      - `delivery_time` (integer, nullable)
      - `notes` (text, nullable)
      - `is_selected` (boolean, default false)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `price_history`
      - `id` (uuid, primary key)
      - `item_id` (uuid, foreign key to items)
      - `supplier_id` (uuid, foreign key to suppliers)
      - `unit_price` (numeric)
      - `purchase_id` (uuid, foreign key to purchases, nullable)
      - `quotation_id` (uuid, foreign key to quotations, nullable)
      - `purchase_date` (date)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for Admin, Gestor, Operador Almoxarife, Operador Financeiro
    - Gestor can only see quotations related to their unit

  3. Indexes
    - Performance indexes for common queries
    - Foreign key indexes

  4. Triggers
    - Audit triggers for all tables
    - Auto-update timestamps
    - Auto-calculate total_price in quotation_responses
*/

-- Create quotations table
CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'rascunho',
  deadline date,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT quotations_status_check CHECK (
    status IN ('rascunho', 'enviada', 'em_analise', 'finalizada', 'cancelada')
  )
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
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  total_price numeric GENERATED ALWAYS AS (unit_price * (
    SELECT quantity FROM quotation_items 
    WHERE quotation_id = quotation_responses.quotation_id 
    AND item_id = quotation_responses.item_id
  )) STORED,
  delivery_time integer CHECK (delivery_time >= 0),
  notes text,
  is_selected boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(quotation_id, supplier_id, item_id)
);

-- Create price_history table
CREATE TABLE IF NOT EXISTS price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  purchase_id uuid REFERENCES purchases(id) ON DELETE SET NULL,
  quotation_id uuid REFERENCES quotations(id) ON DELETE SET NULL,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
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

CREATE POLICY "Gestors can manage quotations of their unit"
  ON quotations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN purchases pu ON pu.id = quotations.purchase_id
      WHERE p.id = auth.uid() 
      AND p.role = 'gestor' 
      AND p.unit_id = pu.unit_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN purchases pu ON pu.id = quotations.purchase_id
      WHERE p.id = auth.uid() 
      AND p.role = 'gestor' 
      AND p.unit_id = pu.unit_id
    )
  );

CREATE POLICY "Almoxarife can manage quotations of their CD"
  ON quotations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN purchases pu ON pu.id = quotations.purchase_id
      WHERE p.id = auth.uid() 
      AND p.role = 'operador-almoxarife' 
      AND p.unit_id = pu.unit_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN purchases pu ON pu.id = quotations.purchase_id
      WHERE p.id = auth.uid() 
      AND p.role = 'operador-almoxarife' 
      AND p.unit_id = pu.unit_id
    )
  );

CREATE POLICY "Financial operators can read quotations"
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
        p.role = 'admin' OR
        (p.role = 'gestor' AND EXISTS (
          SELECT 1 FROM purchases pu 
          WHERE pu.id = q.purchase_id AND pu.unit_id = p.unit_id
        )) OR
        (p.role = 'operador-almoxarife' AND EXISTS (
          SELECT 1 FROM purchases pu 
          WHERE pu.id = q.purchase_id AND pu.unit_id = p.unit_id
        )) OR
        p.role = 'operador-financeiro'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN profiles p ON p.id = auth.uid()
      WHERE q.id = quotation_items.quotation_id
      AND (
        p.role = 'admin' OR
        (p.role = 'gestor' AND EXISTS (
          SELECT 1 FROM purchases pu 
          WHERE pu.id = q.purchase_id AND pu.unit_id = p.unit_id
        )) OR
        (p.role = 'operador-almoxarife' AND EXISTS (
          SELECT 1 FROM purchases pu 
          WHERE pu.id = q.purchase_id AND pu.unit_id = p.unit_id
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
        p.role = 'admin' OR
        (p.role = 'gestor' AND EXISTS (
          SELECT 1 FROM purchases pu 
          WHERE pu.id = q.purchase_id AND pu.unit_id = p.unit_id
        )) OR
        (p.role = 'operador-almoxarife' AND EXISTS (
          SELECT 1 FROM purchases pu 
          WHERE pu.id = q.purchase_id AND pu.unit_id = p.unit_id
        )) OR
        p.role = 'operador-financeiro'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN profiles p ON p.id = auth.uid()
      WHERE q.id = quotation_responses.quotation_id
      AND (
        p.role = 'admin' OR
        (p.role = 'gestor' AND EXISTS (
          SELECT 1 FROM purchases pu 
          WHERE pu.id = q.purchase_id AND pu.unit_id = p.unit_id
        )) OR
        (p.role = 'operador-almoxarife' AND EXISTS (
          SELECT 1 FROM purchases pu 
          WHERE pu.id = q.purchase_id AND pu.unit_id = p.unit_id
        ))
      )
    )
  );

-- RLS Policies for price_history
CREATE POLICY "All authenticated users can read price history"
  ON price_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and financial users can manage price history"
  ON price_history
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'gestor', 'operador-financeiro', 'operador-almoxarife')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'gestor', 'operador-financeiro', 'operador-almoxarife')
    )
  );

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_quotations_updated_at
  BEFORE UPDATE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotation_responses_updated_at
  BEFORE UPDATE ON quotation_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create audit triggers
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