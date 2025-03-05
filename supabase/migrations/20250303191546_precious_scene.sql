/*
  # Create items table

  1. New Tables
    - `items`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles.id)
      - `name` (text)
      - `description` (text)
      - `category` (text)
      - `image_url` (text)
      - `is_available` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  2. Security
    - Enable RLS on `items` table
    - Add policy for authenticated users to read all available items
    - Add policy for authenticated users to read their own items (even if not available)
    - Add policy for authenticated users to create their own items
    - Add policy for authenticated users to update their own items
    - Add policy for authenticated users to delete their own items
*/

CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  image_url text,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Policy for reading available items (for discovery)
CREATE POLICY "Anyone can read available items"
  ON items
  FOR SELECT
  TO authenticated
  USING (is_available = true);

-- Policy for reading own items (even if not available)
CREATE POLICY "Users can read their own items"
  ON items
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy for creating items
CREATE POLICY "Users can create their own items"
  ON items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy for updating items
CREATE POLICY "Users can update their own items"
  ON items
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy for deleting items
CREATE POLICY "Users can delete their own items"
  ON items
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create a trigger to update the updated_at column
CREATE TRIGGER update_items_updated_at
BEFORE UPDATE ON items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();