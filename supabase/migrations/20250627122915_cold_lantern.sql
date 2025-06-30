/*
  # Fix RLS policies for profiles table

  1. Security Changes
    - Drop existing incorrect policies that use uid() instead of auth.uid()
    - Create new policies with correct auth.uid() function
    - Ensure users can only read and update their own profile data

  This fixes the infinite recursion error caused by incorrect policy definitions.
*/

-- Drop existing policies with incorrect uid() function
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create correct policies using auth.uid()
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);