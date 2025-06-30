/*
  # Sistema Financeiro Completo

  1. Novas Tabelas
    - `financial_transactions`
      - `id` (uuid, primary key)
      - `type` (text) - 'income' ou 'expense'
      - `amount` (numeric) - valor da transação
      - `description` (text) - descrição/motivo
      - `unit_id` (uuid) - unidade relacionada
      - `reference_type` (text) - tipo de referência (purchase, manual, etc)
      - `reference_id` (uuid) - ID da referência (purchase_id, etc)
      - `created_by` (uuid) - usuário que criou
      - `created_at` (timestamp)

    - `unit_budgets`
      - `id` (uuid, primary key)
      - `unit_id` (uuid) - unidade
      - `budget_amount` (numeric) - orçamento/saldo da unidade
      - `used_amount` (numeric) - valor já utilizado
      - `available_amount` (numeric) - valor disponível (calculado)
      - `period_start` (date) - início do período
      - `period_end` (date) - fim do período
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Segurança
    - Enable RLS em todas as tabelas
    - Políticas baseadas em roles
    - Triggers para atualização automática

  3. Funções
    - Função para calcular saldo disponível
    - Função para verificar limite de compra
*/

-- Criar tabela de transações financeiras
CREATE TABLE IF NOT EXISTS financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  amount numeric NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  reference_type text DEFAULT 'manual',
  reference_id uuid DEFAULT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de orçamentos por unidade
CREATE TABLE IF NOT EXISTS unit_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  budget_amount numeric NOT NULL DEFAULT 0 CHECK (budget_amount >= 0),
  used_amount numeric NOT NULL DEFAULT 0 CHECK (used_amount >= 0),
  available_amount numeric GENERATED ALWAYS AS (budget_amount - used_amount) STORED,
  period_start date NOT NULL DEFAULT CURRENT_DATE,
  period_end date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 year'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(unit_id, period_start, period_end)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_financial_transactions_unit_id ON financial_transactions(unit_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_type ON financial_transactions(type);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_created_at ON financial_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_unit_budgets_unit_id ON unit_budgets(unit_id);

-- Enable RLS
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_budgets ENABLE ROW LEVEL SECURITY;

-- Políticas para financial_transactions
CREATE POLICY "Financial users can read all transactions"
  ON financial_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'gestor', 'operador-financeiro')
    )
  );

CREATE POLICY "Financial users can create transactions"
  ON financial_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'gestor', 'operador-financeiro')
    )
  );

CREATE POLICY "Admins and gestors can manage transactions"
  ON financial_transactions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'gestor')
    )
  );

-- Políticas para unit_budgets
CREATE POLICY "Financial users can read budgets"
  ON unit_budgets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'gestor', 'operador-financeiro')
    )
  );

CREATE POLICY "Admins and gestors can manage budgets"
  ON unit_budgets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'gestor')
    )
  );

-- Trigger para atualizar updated_at em unit_budgets
CREATE TRIGGER update_unit_budgets_updated_at
  BEFORE UPDATE ON unit_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para atualizar saldo usado quando uma compra é finalizada
CREATE OR REPLACE FUNCTION update_unit_budget_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a compra foi finalizada e tem valor
  IF NEW.status = 'finalizado' AND NEW.total_value IS NOT NULL AND NEW.total_value > 0 THEN
    -- Atualizar o saldo usado da unidade
    UPDATE unit_budgets 
    SET used_amount = used_amount + NEW.total_value
    WHERE unit_id = NEW.unit_id
    AND period_start <= CURRENT_DATE 
    AND period_end >= CURRENT_DATE;
    
    -- Criar transação de despesa
    INSERT INTO financial_transactions (
      type,
      amount,
      description,
      unit_id,
      reference_type,
      reference_id,
      created_by
    ) VALUES (
      'expense',
      NEW.total_value,
      'Compra finalizada - ID: ' || NEW.id::text,
      NEW.unit_id,
      'purchase',
      NEW.id,
      NEW.requester_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar orçamento quando compra é finalizada
CREATE TRIGGER update_budget_on_purchase_finalized
  AFTER UPDATE ON purchases
  FOR EACH ROW
  WHEN (OLD.status != 'finalizado' AND NEW.status = 'finalizado')
  EXECUTE FUNCTION update_unit_budget_on_purchase();

-- Função para verificar se unidade pode fazer compra
CREATE OR REPLACE FUNCTION can_unit_make_purchase(
  p_unit_id uuid,
  p_amount numeric
) RETURNS boolean AS $$
DECLARE
  available_budget numeric;
BEGIN
  -- Buscar orçamento disponível da unidade
  SELECT available_amount INTO available_budget
  FROM unit_budgets
  WHERE unit_id = p_unit_id
  AND period_start <= CURRENT_DATE
  AND period_end >= CURRENT_DATE
  LIMIT 1;
  
  -- Se não tem orçamento definido, não pode comprar
  IF available_budget IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verificar se tem saldo suficiente
  RETURN available_budget >= p_amount;
END;
$$ LANGUAGE plpgsql;

-- Inserir orçamentos iniciais para unidades existentes (opcional)
INSERT INTO unit_budgets (unit_id, budget_amount, period_start, period_end)
SELECT 
  id,
  0, -- Orçamento inicial zerado
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '1 year'
FROM units
WHERE NOT EXISTS (
  SELECT 1 FROM unit_budgets WHERE unit_budgets.unit_id = units.id
);