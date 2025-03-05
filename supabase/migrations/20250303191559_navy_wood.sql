/*
  # Create messages table

  1. New Tables
    - `messages`
      - `id` (uuid, primary key)
      - `trade_id` (uuid, references trades.id)
      - `sender_id` (uuid, references profiles.id)
      - `content` (text)
      - `created_at` (timestamptz)
  2. Security
    - Enable RLS on `messages` table
    - Add policy for authenticated users to read messages for trades they're involved in
    - Add policy for authenticated users to create messages for trades they're involved in
*/

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid REFERENCES trades(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy for reading messages
CREATE POLICY "Users can read messages for trades they're involved in"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = messages.trade_id
      AND (trades.proposer_id = auth.uid() OR trades.receiver_id = auth.uid())
    )
  );

-- Policy for creating messages
CREATE POLICY "Users can create messages for trades they're involved in"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = messages.trade_id
      AND (trades.proposer_id = auth.uid() OR trades.receiver_id = auth.uid())
    )
  );