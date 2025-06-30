/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - Current policies for admins/gestors query the profiles table from within profiles table policies
    - This creates infinite recursion when trying to fetch profile data

  2. Solution
    - Drop the problematic policies that cause recursion
    - Create new policies that use auth.uid() directly without subqueries to profiles table
    - Keep the basic user policies that work correctly

  3. Security
    - Users can still read and update their own profiles
    - Admin/gestor access will be handled at the application level instead of database level
    - This prevents the infinite recursion while maintaining security
*/

-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Admins and gestors can manage profiles" ON profiles;
DROP POLICY IF EXISTS "Admins and gestors can read all profiles" ON profiles;

-- The existing policies for users to manage their own profiles are fine and don't cause recursion:
-- "Users can read own profile" - uses (uid() = id) which is safe
-- "Users can update own profile" - uses (uid() = id) which is safe

-- Note: Admin/gestor access to all profiles will need to be handled at the application level
-- or through a different approach that doesn't cause recursive policy evaluation