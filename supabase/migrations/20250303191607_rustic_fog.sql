/*
  # Create reviews table

  1. New Tables
    - `reviews`
      - `id` (uuid, primary key)
      - `trade_id` (uuid, references trades.id)
      - `reviewer_id` (uuid, references profiles.id)
      - `reviewed_id` (uuid, references profiles.id)
      - `rating` (integer)
      - `comment` (text)
      - `created_at` (timestamptz)
  2. Security
    - Enable RLS on `reviews` table
    - Add policy for authenticated users to read all reviews
    - Add policy for authenticated users to create reviews for trades they're involved in
*/

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid REFERENCES trades(id) ON DELETE CASCADE NOT NULL,
  reviewer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reviewed_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Policy for reading reviews
CREATE POLICY "Anyone can read reviews"
  ON reviews
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for creating reviews
CREATE POLICY "Users can create reviews for trades they're involved in"
  ON reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reviewer_id AND
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = reviews.trade_id
      AND trades.status = 'accepted'
      AND (trades.proposer_id = auth.uid() OR trades.receiver_id = auth.uid())
    )
  );

-- Create a function to update user ratings when a review is added
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the user's rating with the average of all their reviews
  UPDATE profiles
  SET rating = (
    SELECT COALESCE(AVG(rating), 0)
    FROM reviews
    WHERE reviewed_id = NEW.reviewed_id
  )
  WHERE id = NEW.reviewed_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to update user ratings when a review is added
CREATE TRIGGER update_user_rating_on_review
AFTER INSERT OR UPDATE ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_user_rating();