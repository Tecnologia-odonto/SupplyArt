/*
  # Sistema de Ciclo de Vida dos Itens e Novas Permissões

  1. Novas Colunas em Items
    - `show_in_company` - Flag para exibir item nas compras
    - `has_lifecycle` - Flag para habilitar controle de vida útil

  2. Nova Tabela inventory_items
    - Controle individual de cada item no inventário
    - Informações de vida útil, manutenção, garantia
    - Status detalhado de cada item

  3. Segurança
    - RLS habilitado
    - Políticas baseadas em unidade e role
    - Triggers para cálculos automáticos
*/

-- Adicionar novas colunas na tabela items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'items' AND column_name = 'show_in_company'
  ) THEN
    ALTER TABLE items ADD COLUMN show_in_company boolean DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'items' AND column_name = 'has_lifecycle'
  ) THEN
    ALTER TABLE items ADD COLUMN has_lifecycle boolean DEFAULT false;
  END IF;
END $$;

-- Criar tabela para gerenciar vida útil individual dos itens
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  item_code text NOT NULL, -- Código individual do item (ex: AC001-001, AC001-002)
  serial_number text,
  invoice_number text,
  purchase_date date,
  warranty_end_date date,
  status text NOT NULL DEFAULT 'working' CHECK (status IN ('working', 'maintenance', 'broken', 'disposed')),
  last_maintenance_date date,
  next_maintenance_date date,
  maintenance_interval_days integer, -- Intervalo em dias para manutenção preventiva
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_inventory_id ON inventory_items(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_item_code ON inventory_items(item_code);
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_next_maintenance ON inventory_items(next_maintenance_date);

-- Enable RLS
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can read inventory items based on unit access" ON inventory_items;
DROP POLICY IF EXISTS "Users can manage inventory items based on permissions" ON inventory_items;

-- Políticas para inventory_items
CREATE POLICY "Users can read inventory items based on unit access"
  ON inventory_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM inventory i
      JOIN profiles p ON p.id = auth.uid()
      WHERE i.id = inventory_items.inventory_id
      AND (
        p.role IN ('admin', 'gestor', 'operador-almoxarife') OR
        (p.role = 'operador-administrativo' AND p.unit_id = i.unit_id)
      )
    )
  );

CREATE POLICY "Users can manage inventory items based on permissions"
  ON inventory_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM inventory i
      JOIN profiles p ON p.id = auth.uid()
      WHERE i.id = inventory_items.inventory_id
      AND (
        p.role IN ('admin', 'gestor', 'operador-almoxarife') OR
        (p.role = 'operador-administrativo' AND p.unit_id = i.unit_id)
      )
    )
  );

-- Função para calcular próxima data de manutenção
CREATE OR REPLACE FUNCTION update_next_maintenance_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Se tem intervalo de manutenção e data da última manutenção
  IF NEW.maintenance_interval_days IS NOT NULL AND NEW.last_maintenance_date IS NOT NULL THEN
    NEW.next_maintenance_date = NEW.last_maintenance_date + (NEW.maintenance_interval_days || ' days')::interval;
  -- Se tem intervalo mas não tem última manutenção, usar data de compra
  ELSIF NEW.maintenance_interval_days IS NOT NULL AND NEW.purchase_date IS NOT NULL THEN
    NEW.next_maintenance_date = NEW.purchase_date + (NEW.maintenance_interval_days || ' days')::interval;
  -- Se não tem intervalo, limpar próxima manutenção
  ELSE
    NEW.next_maintenance_date = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS calculate_next_maintenance ON inventory_items;
DROP TRIGGER IF EXISTS update_inventory_items_updated_at ON inventory_items;

-- Trigger para calcular próxima manutenção automaticamente
CREATE TRIGGER calculate_next_maintenance
  BEFORE INSERT OR UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_next_maintenance_date();

-- Trigger para updated_at
CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Atualizar itens existentes com as novas flags
UPDATE items SET show_in_company = true WHERE show_in_company IS NULL;
UPDATE items SET has_lifecycle = false WHERE has_lifecycle IS NULL;