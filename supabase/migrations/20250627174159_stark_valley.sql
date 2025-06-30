/*
  # Create inventory_events table for tracking item lifecycle

  1. New Tables
    - `inventory_events`
      - `id` (uuid, primary key)
      - `inventory_id` (uuid, foreign key to inventory table)
      - `event_type` (text, constrained to specific values)
      - `description` (text, required)
      - `performed_by` (text, optional)
      - `cost` (numeric, optional)
      - `notes` (text, optional)
      - `event_date` (date, defaults to current date)
      - `next_action_date` (date, optional)
      - `created_at` (timestamp, defaults to now)

  2. Security
    - Enable RLS on `inventory_events` table
    - Add policies for authenticated users to manage events based on inventory access permissions

  3. Indexes
    - Index on inventory_id for efficient queries
    - Index on event_date for chronological sorting
    - Index on next_action_date for maintenance scheduling
*/

-- Create the inventory_events table
CREATE TABLE IF NOT EXISTS inventory_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid NOT NULL,
  event_type text NOT NULL,
  description text NOT NULL,
  performed_by text,
  cost numeric,
  notes text,
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  next_action_date date,
  created_at timestamptz DEFAULT now()
);

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'inventory_events_inventory_id_fkey'
  ) THEN
    ALTER TABLE inventory_events 
    ADD CONSTRAINT inventory_events_inventory_id_fkey 
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add check constraint for event_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'inventory_events_event_type_check'
  ) THEN
    ALTER TABLE inventory_events 
    ADD CONSTRAINT inventory_events_event_type_check 
    CHECK (event_type = ANY (ARRAY['maintenance'::text, 'repair'::text, 'inspection'::text, 'relocation'::text, 'status_change'::text, 'other'::text]));
  END IF;
END $$;

-- Add check constraint for cost (must be positive if provided)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'inventory_events_cost_check'
  ) THEN
    ALTER TABLE inventory_events 
    ADD CONSTRAINT inventory_events_cost_check 
    CHECK (cost IS NULL OR cost >= 0);
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_events_inventory_id ON inventory_events(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_events_event_date ON inventory_events(event_date);
CREATE INDEX IF NOT EXISTS idx_inventory_events_next_action_date ON inventory_events(next_action_date);
CREATE INDEX IF NOT EXISTS idx_inventory_events_event_type ON inventory_events(event_type);

-- Enable Row Level Security
ALTER TABLE inventory_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies based on inventory access permissions
CREATE POLICY "Users can read inventory events based on inventory access"
  ON inventory_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM inventory i
      JOIN profiles p ON p.id = auth.uid()
      WHERE i.id = inventory_events.inventory_id
      AND (
        p.role = ANY (ARRAY['admin'::text, 'gestor'::text, 'operador-almoxarife'::text])
        OR (p.role = 'operador-administrativo'::text AND p.unit_id = i.unit_id)
      )
    )
  );

CREATE POLICY "Users can manage inventory events based on inventory access"
  ON inventory_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM inventory i
      JOIN profiles p ON p.id = auth.uid()
      WHERE i.id = inventory_events.inventory_id
      AND (
        p.role = ANY (ARRAY['admin'::text, 'gestor'::text, 'operador-almoxarife'::text])
        OR (p.role = 'operador-administrativo'::text AND p.unit_id = i.unit_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM inventory i
      JOIN profiles p ON p.id = auth.uid()
      WHERE i.id = inventory_events.inventory_id
      AND (
        p.role = ANY (ARRAY['admin'::text, 'gestor'::text, 'operador-almoxarife'::text])
        OR (p.role = 'operador-administrativo'::text AND p.unit_id = i.unit_id)
      )
    )
  );