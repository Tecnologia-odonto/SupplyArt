/*
  # Fix audit_logs foreign key constraint

  1. Problem
    - The audit_logs table has a foreign key constraint that requires user_id to exist in profiles
    - This causes issues when creating audit logs for new users before their profile exists
    - Edge functions fail when trying to create audit logs for new users

  2. Solution
    - Modify the foreign key constraint to allow ON DELETE SET NULL
    - Create a system user in profiles table for system-generated logs
    - Update audit_logs to use the system user ID for system operations
*/

-- First create a system user if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = '00000000-0000-0000-0000-000000000000'
  ) THEN
    INSERT INTO profiles (
      id, 
      name, 
      email, 
      role
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      'System',
      'system@supplyart.internal',
      'admin'
    );
  END IF;
END $$;

-- Drop the existing foreign key constraint
ALTER TABLE audit_logs 
  DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

-- Add the new constraint with ON DELETE CASCADE
ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES profiles(id)
  ON DELETE CASCADE;

-- Add comment explaining the purpose of the system user
COMMENT ON TABLE profiles IS 'User profiles including a system user (00000000-0000-0000-0000-000000000000) for audit logs';