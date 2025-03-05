/*
  # Create trades table

  1. New Tables
    - `trades`
      - `id` (uuid, primary key)
      - `proposer_id` (uuid, references profiles.id)
      - `receiver_id` (uuid, references profiles.id)
      - `offered_item_id` (uuid, references items.id)
      - `requested_item_id` (uuid, references items.id)
      - `status` (text: 'pending', 'accepted', 'rejected')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  2. Security
    - Enable RLS on `trades` table
    - Add policy for authenticated users to read trades they're involved in
    - Add policy for authenticated users to create trades
    - Add policy for authenticated users to update trades they're involved in
*/

CREATE TABLE IF NOT EXISTS trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  offered_item_id uuid REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  requested_item_id uuid REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Policy for reading trades
CREATE POLICY "Users can read trades they're involved in"
  ON trades
  FOR SELECT
  TO authenticated
  USING (auth.uid() = proposer_id OR auth.uid() = receiver_id);

-- Policy for creating trades
CREATE POLICY "Users can create trades"
  ON trades
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = proposer_id);

-- Policy for updating trades
CREATE POLICY "Users can update trades they're involved in"
  ON trades
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = proposer_id OR auth.uid() = receiver_id);

-- Create a trigger to update the updated_at column
CREATE TRIGGER update_trades_updated_at
BEFORE UPDATE ON trades
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();