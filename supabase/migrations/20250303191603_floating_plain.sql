/*
  # Create user interests table

  1. New Tables
    - `user_interests`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles.id)
      - `interest` (text)
      - `created_at` (timestamptz)
  2. Security
    - Enable RLS on `user_interests` table
    - Add policy for authenticated users to read all user interests
    - Add policy for authenticated users to create their own interests
    - Add policy for authenticated users to delete their own interests
*/

CREATE TABLE IF NOT EXISTS user_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  interest text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;

-- Policy for reading user interests
CREATE POLICY "Anyone can read user interests"
  ON user_interests
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for creating user interests
CREATE POLICY "Users can create their own interests"
  ON user_interests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy for deleting user interests
CREATE POLICY "Users can delete their own interests"
  ON user_interests
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);