/*
  # Sistema de Pedidos Internos

  1. Novas Tabelas
    - `requests` - Pedidos internos entre unidades e CDs
      - `id` (uuid, primary key)
      - `requesting_unit_id` (uuid) - unidade solicitante
      - `cd_unit_id` (uuid) - centro de distribuição responsável
      - `requester_id` (uuid) - usuário solicitante
      - `status` (text) - status do pedido
      - `priority` (text) - prioridade do pedido
      - `notes` (text) - observações
      - `rejection_reason` (text) - motivo de rejeição
      - `approved_by` (uuid) - quem aprovou/rejeitou
      - `approved_at` (timestamp) - quando foi aprovado/rejeitado
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `request_items` - Itens dos pedidos internos
      - `id` (uuid, primary key)
      - `request_id` (uuid) - pedido relacionado
      - `item_id` (uuid) - item solicitado
      - `quantity_requested` (numeric) - quantidade solicitada
      - `quantity_approved` (numeric) - quantidade aprovada
      - `quantity_sent` (numeric) - quantidade enviada
      - `cd_stock_available` (numeric) - estoque disponível no CD
      - `needs_purchase` (boolean) - se precisa comprar
      - `notes` (text) - observações
      - `created_at` (timestamp)

  2. Alterações em Tabelas Existentes
    - `purchases` - Adicionar campo `request_id` para vincular compras a pedidos

  3. Segurança
    - Enable RLS em todas as tabelas
    - Políticas baseadas em roles
    - Triggers para atualização automática
*/

-- Criar tabela de pedidos internos
CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requesting_unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  cd_unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'solicitado' CHECK (status IN ('solicitado', 'analisando', 'aprovado', 'rejeitado', 'preparando', 'enviado', 'recebido', 'cancelado')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('baixa', 'normal', 'alta', 'urgente')),
  notes text,
  rejection_reason text,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de itens dos pedidos
CREATE TABLE IF NOT EXISTS request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity_requested numeric NOT NULL,
  quantity_approved numeric,
  quantity_sent numeric,
  cd_stock_available numeric,
  needs_purchase boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Adicionar campo request_id à tabela purchases
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchases' AND column_name = 'request_id'
  ) THEN
    ALTER TABLE purchases ADD COLUMN request_id uuid REFERENCES requests(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_requests_requesting_unit_id ON requests(requesting_unit_id);
CREATE INDEX IF NOT EXISTS idx_requests_cd_unit_id ON requests(cd_unit_id);
CREATE INDEX IF NOT EXISTS idx_requests_requester_id ON requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_priority ON requests(priority);
CREATE INDEX IF NOT EXISTS idx_request_items_request_id ON request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_request_items_item_id ON request_items(item_id);
CREATE INDEX IF NOT EXISTS idx_purchases_request_id ON purchases(request_id);

-- Enable RLS
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_items ENABLE ROW LEVEL SECURITY;

-- Políticas para requests
CREATE POLICY "Users can read requests based on role"
  ON requests
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
        (p.role = 'gestor' AND p.unit_id = requests.requesting_unit_id) OR
        -- Op. administrativo: somente seus pedidos
        (p.role = 'operador-administrativo' AND requests.requester_id = p.id) OR
        -- Op. almoxarife: pode ver todos
        p.role = 'operador-almoxarife' OR
        -- Op. financeiro: todos da sua unidade
        (p.role = 'operador-financeiro' AND p.unit_id = requests.requesting_unit_id)
      )
    )
  );

CREATE POLICY "Users can create requests based on role"
  ON requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'gestor', 'operador-administrativo', 'operador-financeiro', 'operador-almoxarife')
    )
  );

CREATE POLICY "Users can update requests based on role"
  ON requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (
        -- Admin e gestor podem editar qualquer pedido
        p.role IN ('admin', 'gestor') OR
        -- Op. almoxarife pode editar status
        p.role = 'operador-almoxarife' OR
        -- Op. administrativo pode editar apenas seus próprios pedidos em status inicial
        (p.role = 'operador-administrativo' AND 
         requests.requester_id = p.id AND 
         requests.status IN ('solicitado', 'analisando'))
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'gestor') OR
        p.role = 'operador-almoxarife' OR
        (p.role = 'operador-administrativo' AND 
         requests.requester_id = p.id AND 
         requests.status IN ('solicitado', 'analisando'))
      )
    )
  );

-- Políticas para request_items
CREATE POLICY "Users can access request items through requests"
  ON request_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requests r
      JOIN profiles p ON p.id = auth.uid()
      WHERE r.id = request_items.request_id
      AND (
        -- Admin: pode ver todos
        p.role = 'admin' OR
        -- Gestor: todos da sua unidade
        (p.role = 'gestor' AND p.unit_id = r.requesting_unit_id) OR
        -- Op. administrativo: somente seus pedidos
        (p.role = 'operador-administrativo' AND r.requester_id = p.id) OR
        -- Op. almoxarife: pode ver todos
        p.role = 'operador-almoxarife' OR
        -- Op. financeiro: todos da sua unidade
        (p.role = 'operador-financeiro' AND p.unit_id = r.requesting_unit_id)
      )
    )
  );

CREATE POLICY "Users can manage request items through requests"
  ON request_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requests r
      JOIN profiles p ON p.id = auth.uid()
      WHERE r.id = request_items.request_id
      AND (
        -- Admin e gestor podem editar qualquer pedido
        p.role IN ('admin', 'gestor') OR
        -- Op. almoxarife pode editar status
        p.role = 'operador-almoxarife' OR
        -- Op. administrativo pode editar apenas seus próprios pedidos em status inicial
        (p.role = 'operador-administrativo' AND 
         r.requester_id = p.id AND 
         r.status IN ('solicitado', 'analisando'))
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM requests r
      JOIN profiles p ON p.id = auth.uid()
      WHERE r.id = request_items.request_id
      AND (
        p.role IN ('admin', 'gestor') OR
        p.role = 'operador-almoxarife' OR
        (p.role = 'operador-administrativo' AND 
         r.requester_id = p.id AND 
         r.status IN ('solicitado', 'analisando'))
      )
    )
  );

-- Trigger para atualizar updated_at em requests
CREATE TRIGGER update_requests_updated_at
  BEFORE UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para processar pedidos aprovados
CREATE OR REPLACE FUNCTION process_approved_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o pedido foi aprovado
  IF NEW.status = 'aprovado' AND OLD.status != 'aprovado' THEN
    -- Atualizar os itens do pedido com as quantidades aprovadas
    UPDATE request_items
    SET quantity_approved = quantity_requested
    WHERE request_id = NEW.id
    AND quantity_approved IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para processar pedidos aprovados
CREATE TRIGGER process_request_approval
  AFTER UPDATE ON requests
  FOR EACH ROW
  WHEN (OLD.status != 'aprovado' AND NEW.status = 'aprovado')
  EXECUTE FUNCTION process_approved_request();

-- Função para processar pedidos enviados
CREATE OR REPLACE FUNCTION process_sent_request()
RETURNS TRIGGER AS $$
DECLARE
  request_item RECORD;
  user_id_val uuid;
BEGIN
  -- Se o pedido foi enviado
  IF NEW.status = 'enviado' AND OLD.status != 'enviado' THEN
    
    -- Tentar obter o ID do usuário atual
    BEGIN
      user_id_val := auth.uid();
    EXCEPTION WHEN OTHERS THEN
      user_id_val := NEW.approved_by; -- Usar o aprovador como fallback
    END;

    IF user_id_val IS NULL THEN
      user_id_val := NEW.approved_by;
    END IF;

    -- Processar cada item do pedido
    FOR request_item IN 
      SELECT ri.*, i.name as item_name, i.code as item_code
      FROM request_items ri
      JOIN items i ON i.id = ri.item_id
      WHERE ri.request_id = NEW.id
    LOOP
      -- Atualizar quantidade enviada
      UPDATE request_items 
      SET quantity_sent = COALESCE(quantity_approved, quantity_requested)
      WHERE id = request_item.id;
      
      -- Subtrair do estoque do CD
      UPDATE stock 
      SET quantity = quantity - COALESCE(request_item.quantity_approved, request_item.quantity_requested)
      WHERE item_id = request_item.item_id 
      AND unit_id = NEW.cd_unit_id;
      
      -- Adicionar ao estoque da unidade solicitante
      -- Verificar se já existe estoque para este item nesta unidade
      IF EXISTS (
        SELECT 1 FROM stock 
        WHERE item_id = request_item.item_id 
        AND unit_id = NEW.requesting_unit_id
      ) THEN
        -- Atualizar estoque existente
        UPDATE stock 
        SET 
          quantity = quantity + COALESCE(request_item.quantity_approved, request_item.quantity_requested),
          updated_at = now()
        WHERE item_id = request_item.item_id 
        AND unit_id = NEW.requesting_unit_id;
      ELSE
        -- Criar novo registro de estoque
        INSERT INTO stock (
          item_id,
          unit_id,
          quantity,
          min_quantity,
          max_quantity,
          location
        ) VALUES (
          request_item.item_id,
          NEW.requesting_unit_id,
          COALESCE(request_item.quantity_approved, request_item.quantity_requested),
          0, -- Quantidade mínima padrão
          NULL, -- Sem máximo definido inicialmente
          'Estoque Geral' -- Localização padrão
        );
      END IF;

      -- Criar movimentação
      INSERT INTO movements (
        item_id,
        from_unit_id,
        to_unit_id,
        quantity,
        type,
        reference,
        notes,
        created_by
      ) VALUES (
        request_item.item_id,
        NEW.cd_unit_id,
        NEW.requesting_unit_id,
        COALESCE(request_item.quantity_approved, request_item.quantity_requested),
        'transfer',
        'Request #' || NEW.id::text,
        format('Item %s (%s) transferido do CD para unidade solicitante via pedido interno', 
               request_item.item_name, 
               request_item.item_code),
        user_id_val
      );
    END LOOP;

    -- Log geral do envio
    INSERT INTO audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      old_values,
      new_values
    ) VALUES (
      user_id_val,
      'REQUEST_SENT_STOCK_UPDATED',
      'requests',
      NEW.id::text,
      jsonb_build_object(
        'old_status', OLD.status
      ),
      jsonb_build_object(
        'new_status', NEW.status,
        'requesting_unit_id', NEW.requesting_unit_id,
        'cd_unit_id', NEW.cd_unit_id,
        'total_items_processed', (
          SELECT COUNT(*) 
          FROM request_items 
          WHERE request_id = NEW.id
        ),
        'sent_at', now()
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para processar pedidos enviados
CREATE TRIGGER process_request_sent
  AFTER UPDATE ON requests
  FOR EACH ROW
  WHEN (OLD.status != 'enviado' AND NEW.status = 'enviado')
  EXECUTE FUNCTION process_sent_request();

-- Comentários sobre as funções
COMMENT ON FUNCTION process_approved_request() IS 
'Processa automaticamente pedidos aprovados, atualizando as quantidades aprovadas';

COMMENT ON FUNCTION process_sent_request() IS 
'Processa automaticamente pedidos enviados, movendo itens entre estoques e criando movimentações';