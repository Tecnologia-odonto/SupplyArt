/*
  # Add INSERT policy for profiles table

  1. Security Changes
    - Add RLS policy to allow authenticated users to insert their own profile data
    - This enables user registration to work properly by allowing users to create their profile record

  2. Policy Details
    - Policy name: "Users can insert own profile"
    - Allows INSERT operations for authenticated users
    - Restricts insertion to records where the id matches the authenticated user's ID (auth.uid())
*/

-- Add INSERT policy for profiles table to allow users to create their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);