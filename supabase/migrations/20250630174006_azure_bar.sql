/*
  # Fix audit_logs foreign key constraint

  1. Changes
    - Allow NULL values in audit_logs.user_id column
    - Update foreign key constraint to support NULL values
    - Add comment explaining the purpose of NULL user_id

  2. Purpose
    - Enable system operations to create audit logs without a user ID
    - Support automated processes and edge functions
    - Maintain data integrity while allowing flexibility
*/

-- First, allow NULL values in audit_logs.user_id
ALTER TABLE audit_logs 
  ALTER COLUMN user_id DROP NOT NULL;

-- Drop the existing foreign key constraint
ALTER TABLE audit_logs 
  DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

-- Add the new constraint that allows NULL values
ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES profiles(id)
  ON DELETE CASCADE;

-- Add comment explaining the NULL user_id usage
COMMENT ON COLUMN audit_logs.user_id IS 'User ID who performed the action. NULL for system operations or when user context is not available.';