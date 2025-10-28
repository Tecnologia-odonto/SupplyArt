/*
  # Adicionar budget_id à tabela requests

  1. Modificações
    - Adiciona coluna `budget_id` para rastrear qual orçamento foi usado
    - Adiciona foreign key para `unit_budgets`
  
  2. Propósito
    - Permitir débito parcial do orçamento quando pedido é aprovado
    - Facilitar devolução de orçamento quando status é alterado
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'requests' AND column_name = 'budget_id'
  ) THEN
    ALTER TABLE requests ADD COLUMN budget_id uuid REFERENCES unit_budgets(id);
  END IF;
END $$;
