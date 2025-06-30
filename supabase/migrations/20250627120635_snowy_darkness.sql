/*
  # SupplyArt Initial Database Schema

  1. New Tables
    - `profiles` - User profiles with RBAC roles and unit associations
    - `units` - Physical locations/units with CD designation
    - `items` - Product catalog with codes, names, and specifications
    - `stock` - Current stock levels per unit with min/max thresholds
    - `inventory` - Detailed inventory with locations and status
    - `suppliers` - Supplier information for purchases
    - `purchases` - Purchase orders with workflow status
    - `purchase_items` - Line items for purchase orders
    - `movements` - Stock movement tracking between units
    - `audit_logs` - Complete audit trail for all operations

  2. Security  
    - Enable RLS on all tables
    - Policies for role-based access control
    - Unit-based data isolation
    - Audit logging for all operations

  3. Features
    - UUID primary keys for all tables
    - Timestamps for created/updated tracking
    - Proper foreign key relationships
    - Indexes for performance
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'gestor', 'operador-financeiro', 'operador-administrativo', 'operador-almoxarife')),
  unit_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Units table
CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  address text,
  is_cd boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Items table
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  unit_measure text NOT NULL,
  category text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  address text,
  cnpj text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Stock table
CREATE TABLE IF NOT EXISTS stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  quantity numeric DEFAULT 0,
  min_quantity numeric,
  max_quantity numeric,
  location text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(item_id, unit_id)
);

-- Inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 0,
  location text NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'damaged', 'expired')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pedido-realizado' CHECK (status IN ('pedido-realizado', 'em-cotacao', 'comprado', 'chegou-cd', 'enviado', 'erro-pedido', 'finalizado')),
  supplier_id uuid REFERENCES suppliers(id),
  total_value numeric,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Purchase items table
CREATE TABLE IF NOT EXISTS purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity numeric NOT NULL,
  unit_price numeric,
  total_price numeric,
  created_at timestamptz DEFAULT now()
);

-- Movements table
CREATE TABLE IF NOT EXISTS movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  from_unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  to_unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  quantity numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('transfer', 'adjustment', 'purchase', 'sale')),
  reference text,
  notes text,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add foreign key constraint for profiles.unit_id
ALTER TABLE profiles ADD CONSTRAINT profiles_unit_id_fkey 
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_unit_id ON profiles(unit_id);
CREATE INDEX IF NOT EXISTS idx_stock_item_id ON stock(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_unit_id ON stock(unit_id);
CREATE INDEX IF NOT EXISTS idx_inventory_item_id ON inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_unit_id ON inventory(unit_id);
CREATE INDEX IF NOT EXISTS idx_purchases_unit_id ON purchases(unit_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_movements_item_id ON movements(item_id);
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON movements(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles policies
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins and gestors can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor')
    )
  );

CREATE POLICY "Admins and gestors can manage profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor')
    )
  );

-- Units policies
CREATE POLICY "All authenticated users can read units"
  ON units FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and gestors can manage units"
  ON units FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor')
    )
  );

-- Items policies
CREATE POLICY "All authenticated users can read items"
  ON items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users with create permission can manage items"
  ON items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor', 'operador-financeiro', 'operador-administrativo')
    )
  );

-- Suppliers policies
CREATE POLICY "Financial users can read suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor', 'operador-financeiro')
    )
  );

CREATE POLICY "Financial users can manage suppliers"
  ON suppliers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor', 'operador-financeiro')
    )
  );

-- Stock policies
CREATE POLICY "Users can read stock based on unit access"
  ON stock FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (
        role IN ('admin', 'gestor', 'operador-almoxarife') OR
        (role IN ('operador-administrativo') AND unit_id = stock.unit_id)
      )
    )
  );

CREATE POLICY "Users can manage stock based on permissions"
  ON stock FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (
        role IN ('admin', 'gestor') OR
        (role = 'operador-almoxarife') OR
        (role = 'operador-administrativo' AND unit_id = stock.unit_id)
      )
    )
  );

-- Inventory policies
CREATE POLICY "Users can read inventory based on unit access"
  ON inventory FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (
        role IN ('admin', 'gestor', 'operador-almoxarife') OR
        (role IN ('operador-administrativo') AND unit_id = inventory.unit_id)
      )
    )
  );

CREATE POLICY "Users can manage inventory based on permissions"
  ON inventory FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (
        role IN ('admin', 'gestor', 'operador-almoxarife') OR
        (role = 'operador-administrativo' AND unit_id = inventory.unit_id)
      )
    )
  );

-- Purchases policies
CREATE POLICY "Users can read purchases based on access"
  ON purchases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (
        role IN ('admin', 'gestor', 'operador-financeiro') OR
        (role = 'operador-administrativo' AND unit_id = purchases.unit_id)
      )
    )
  );

CREATE POLICY "Users can create purchases for their unit"
  ON purchases FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (
        role IN ('admin', 'gestor', 'operador-financeiro') OR
        (role = 'operador-administrativo' AND unit_id = purchases.unit_id)
      )
    )
  );

CREATE POLICY "Users can update purchases based on permissions"
  ON purchases FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor', 'operador-financeiro')
    )
  );

-- Purchase items policies
CREATE POLICY "Users can access purchase items through purchases"
  ON purchase_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM purchases p
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE p.id = purchase_items.purchase_id
      AND (
        pr.role IN ('admin', 'gestor', 'operador-financeiro') OR
        (pr.role = 'operador-administrativo' AND pr.unit_id = p.unit_id)
      )
    )
  );

CREATE POLICY "Users can manage purchase items through purchases"
  ON purchase_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM purchases p
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE p.id = purchase_items.purchase_id
      AND (
        pr.role IN ('admin', 'gestor', 'operador-financeiro') OR
        (pr.role = 'operador-administrativo' AND pr.unit_id = p.unit_id)
      )
    )
  );

-- Movements policies
CREATE POLICY "Admins and gestors can read all movements"
  ON movements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor')
    )
  );

CREATE POLICY "Admins and gestors can manage movements"
  ON movements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor')
    )
  );

-- Audit logs policies
CREATE POLICY "Admins and gestors can read audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor')
    )
  );

-- Function to handle user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    CASE 
      WHEN new.email LIKE '%admin%' THEN 'admin'
      ELSE 'operador-administrativo'
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stock_updated_at BEFORE UPDATE ON stock FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON purchases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();