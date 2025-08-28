/*
  # Fix audit logs user_id nullable constraint

  1. Changes
    - Make user_id column nullable in audit_logs table
    - This allows system operations and failed login attempts to be logged without requiring a valid user_id

  2. Security
    - Maintains existing RLS policies
    - No changes to access control
*/

-- Make user_id nullable in audit_logs table
ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL;

-- Update the comment to reflect the change
COMMENT ON COLUMN audit_logs.user_id IS 'User ID who performed the action. NULL for system operations or when user context is not available.';