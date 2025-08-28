/*
  # Fix request_items RLS policies for INSERT operations

  1. Security Changes
    - Update INSERT policy for request_items to allow proper creation
    - Ensure users can create request items for requests they are authorized to create
    - Maintain security while allowing legitimate operations

  2. Policy Updates
    - Allow INSERT operations based on request permissions
    - Users can create request items if they can create the parent request
*/

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can access request items through requests" ON request_items;
DROP POLICY IF EXISTS "Users can manage request items through requests" ON request_items;

-- Create new comprehensive policies
CREATE POLICY "Users can read request items through requests"
  ON request_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requests r
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE r.id = request_items.request_id
      AND (
        pr.role = 'admin'
        OR (pr.role = 'gestor' AND pr.unit_id = r.requesting_unit_id)
        OR (pr.role = 'operador-administrativo' AND r.requester_id = pr.id)
        OR pr.role = 'operador-almoxarife'
        OR (pr.role = 'operador-financeiro' AND pr.unit_id = r.requesting_unit_id)
      )
    )
  );

CREATE POLICY "Users can insert request items"
  ON request_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM requests r
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE r.id = request_items.request_id
      AND (
        pr.role IN ('admin', 'gestor', 'operador-administrativo')
        AND (
          pr.role = 'admin'
          OR (pr.role = 'gestor' AND pr.unit_id = r.requesting_unit_id)
          OR (pr.role = 'operador-administrativo' AND r.requester_id = pr.id)
        )
      )
    )
  );

CREATE POLICY "Users can update request items"
  ON request_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requests r
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE r.id = request_items.request_id
      AND (
        pr.role IN ('admin', 'gestor', 'operador-almoxarife')
        OR (pr.role = 'operador-administrativo' AND r.requester_id = pr.id AND r.status IN ('solicitado', 'analisando'))
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM requests r
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE r.id = request_items.request_id
      AND (
        pr.role IN ('admin', 'gestor', 'operador-almoxarife')
        OR (pr.role = 'operador-administrativo' AND r.requester_id = pr.id AND r.status IN ('solicitado', 'analisando'))
      )
    )
  );

CREATE POLICY "Users can delete request items"
  ON request_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requests r
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE r.id = request_items.request_id
      AND (
        pr.role IN ('admin', 'gestor')
        OR (pr.role = 'operador-administrativo' AND r.requester_id = pr.id AND r.status IN ('solicitado', 'analisando'))
      )
    )
  );