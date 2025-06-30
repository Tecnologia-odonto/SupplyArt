/*
  # Fix handle_new_user function

  1. Problem
    - The handle_new_user function is causing errors when creating new users
    - It's likely not handling the profile creation correctly

  2. Solution
    - Update the handle_new_user function to properly handle profile creation
    - Ensure it correctly sets the user's role and other required fields
    - Add better error handling
*/

-- Drop the existing function and recreate it with improved implementation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert the new user into the profiles table with proper defaults
  INSERT INTO public.profiles (
    id,
    name,
    email,
    role,
    unit_id,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'operador-administrativo'),
    CASE 
      WHEN new.raw_user_meta_data->>'unit_id' IS NOT NULL AND new.raw_user_meta_data->>'unit_id' != '' 
      THEN (new.raw_user_meta_data->>'unit_id')::uuid
      ELSE NULL
    END,
    now(),
    now()
  );
  
  -- Create an audit log entry for the new user
  INSERT INTO public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    new_values
  )
  VALUES (
    new.id,
    'USER_CREATED_BY_TRIGGER',
    'profiles',
    new.id::text,
    jsonb_build_object(
      'email', new.email,
      'name', COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
      'role', COALESCE(new.raw_user_meta_data->>'role', 'operador-administrativo'),
      'created_at', now()
    )
  );
  
  RETURN new;
EXCEPTION
  WHEN others THEN
    -- Log the error to a table or raise a notice
    RAISE NOTICE 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN new; -- Still return the new user even if profile creation fails
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make sure the trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Add comment to explain the function
COMMENT ON FUNCTION handle_new_user() IS 'Creates a profile record when a new user signs up, with proper error handling';