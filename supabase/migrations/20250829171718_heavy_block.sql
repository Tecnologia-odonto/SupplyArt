/*
  # Fix budget trigger for generated column

  1. Problem
    - The trigger `consume_budget_on_approval` is trying to update the generated column `available_amount`
    - Generated columns cannot be updated directly, only their base columns

  2. Solution
    - Modify the trigger to only update `used_amount` instead of `available_amount`
    - The `available_amount` will be automatically recalculated as `(budget_amount - used_amount)`

  3. Changes
    - Update the `consume_budget_on_approval` function to work with base columns only
*/

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS consume_budget_on_request_approval ON requests;
DROP FUNCTION IF EXISTS consume_budget_on_approval();

-- Create the corrected function that only updates base columns
CREATE OR REPLACE FUNCTION consume_budget_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only consume budget when status changes to 'aprovado'
  IF OLD.status != 'aprovado' AND NEW.status = 'aprovado' THEN
    -- Update the used_amount in unit_budgets (available_amount will be recalculated automatically)
    UPDATE unit_budgets 
    SET used_amount = used_amount + COALESCE(NEW.total_estimated_cost, 0)
    WHERE unit_id = NEW.requesting_unit_id 
      AND period_start <= CURRENT_DATE 
      AND period_end >= CURRENT_DATE;
      
    -- Set budget consumption tracking fields
    NEW.budget_consumed = true;
    NEW.budget_consumption_date = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER consume_budget_on_request_approval
  BEFORE UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION consume_budget_on_approval();