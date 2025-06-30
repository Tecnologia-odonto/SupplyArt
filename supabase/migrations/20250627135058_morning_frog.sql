/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - Current policies on profiles table create infinite recursion
    - Policies try to check user role by querying profiles table within the policy itself
    - This creates a circular dependency

  2. Solution
    - Drop existing problematic policies
    - Create new policies that avoid recursion
    - Use auth.uid() directly for user-specific access
    - Create separate policies for different access patterns

  3. Security
    - Users can read/update their own profile
    - Admins and gestors can manage all profiles
    - Policies are simplified to avoid recursion
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Users can read profiles based on role" ON profiles;
DROP POLICY IF EXISTS "Users can insert profiles based on role" ON profiles;
DROP POLICY IF EXISTS "Users can update profiles based on role" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- Create new policies that avoid recursion

-- Policy 1: Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy 2: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 3: Users can insert their own profile (for registration)
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Policy 4: Service role can manage all profiles (for admin operations)
CREATE POLICY "Service role can manage profiles"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create a function to check if user is admin/gestor without recursion
CREATE OR REPLACE FUNCTION is_admin_or_gestor(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND role IN ('admin', 'gestor')
  );
$$;

-- Policy 5: Admins and gestors can read all profiles
CREATE POLICY "Admins and gestors can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR 
    is_admin_or_gestor(auth.uid())
  );

-- Policy 6: Admins and gestors can update all profiles
CREATE POLICY "Admins and gestors can update all profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id OR 
    is_admin_or_gestor(auth.uid())
  )
  WITH CHECK (
    auth.uid() = id OR 
    is_admin_or_gestor(auth.uid())
  );

-- Policy 7: Admins and gestors can insert profiles
CREATE POLICY "Admins and gestors can insert profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id OR 
    is_admin_or_gestor(auth.uid())
  );

-- Policy 8: Admins can delete profiles
CREATE POLICY "Admins can delete profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (is_admin_or_gestor(auth.uid()));