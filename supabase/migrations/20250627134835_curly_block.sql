/*
  # Fix RLS policies for user management

  1. Security Changes
    - Allow admins and gestors to read all profiles
    - Allow admins and gestors to manage all profiles
    - Allow admins to delete profiles
    - Users can still manage their own profiles

  2. Policy Updates
    - Updated SELECT policy to allow role-based access
    - Updated UPDATE policy for role-based management
    - Added INSERT policy for user creation
    - Added DELETE policy for admins only
*/

-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;

-- Create new SELECT policy that allows:
-- 1. Users to read their own profile
-- 2. Admins and gestors to read all profiles
CREATE POLICY "Users can read profiles based on role"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Users can always read their own profile
    (auth.uid() = id) 
    OR 
    -- Admins and gestors can read all profiles
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'gestor')
    ))
  );

-- Also ensure admins and gestors can manage other users
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Allow users to update their own profile, and admins/gestors to update any profile
CREATE POLICY "Users can update profiles based on role"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- Users can update their own profile
    (auth.uid() = id)
    OR
    -- Admins and gestors can update any profile
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'gestor')
    ))
  )
  WITH CHECK (
    -- Same conditions for the updated data
    (auth.uid() = id)
    OR
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'gestor')
    ))
  );

-- Allow profile creation (for new user registration and admin user creation)
CREATE POLICY "Users can insert profiles based on role"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can create their own profile (during registration)
    (auth.uid() = id)
    OR
    -- Admins and gestors can create profiles for others
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'gestor')
    ))
  );

-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );