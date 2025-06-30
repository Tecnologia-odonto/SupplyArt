/*
  # Fix audit logs foreign key constraint

  1. Changes
    - Allow NULL values in audit_logs.user_id for system operations
    - Update the foreign key constraint to handle system operations
    - Update audit log creation function to handle NULL user_id

  2. Security
    - Maintain data integrity while allowing system operations
    - Keep existing RLS policies intact
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

-- Update the create_audit_log function to handle NULL user_id better
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  user_id_val uuid;
BEGIN
  -- Try to get current user ID, but allow NULL for system operations
  BEGIN
    user_id_val := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    user_id_val := NULL;
  END;

  -- For system operations where no user is authenticated, use NULL
  IF user_id_val IS NULL THEN
    user_id_val := NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      old_values
    ) VALUES (
      user_id_val,
      'DELETE',
      TG_TABLE_NAME,
      OLD.id::text,
      row_to_json(OLD)
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      old_values,
      new_values
    ) VALUES (
      user_id_val,
      'UPDATE',
      TG_TABLE_NAME,
      NEW.id::text,
      row_to_json(OLD),
      row_to_json(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      new_values
    ) VALUES (
      user_id_val,
      'INSERT',
      TG_TABLE_NAME,
      NEW.id::text,
      row_to_json(NEW)
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the handle_new_user function to avoid audit log issues
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    CASE 
      WHEN new.email LIKE '%admin%' THEN 'admin'
      ELSE 'operador-administrativo'
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the NULL user_id usage
COMMENT ON COLUMN audit_logs.user_id IS 'User ID who performed the action. NULL for system operations or when user context is not available.';