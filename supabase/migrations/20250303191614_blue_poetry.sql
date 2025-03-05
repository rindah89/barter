/*
  # Create helper functions

  1. Functions
    - `handle_new_user()`: Creates a profile entry when a new user signs up
    - `update_completed_trades()`: Updates the completed_trades count when a trade is accepted
*/

-- Function to create a profile when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NEW.email,
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=600&auto=format&fit=crop'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create a profile when a new user signs up
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();

-- Function to update completed trades count when a trade is accepted
CREATE OR REPLACE FUNCTION update_completed_trades()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Update proposer's completed trades count
    UPDATE profiles
    SET completed_trades = completed_trades + 1
    WHERE id = NEW.proposer_id;
    
    -- Update receiver's completed trades count
    UPDATE profiles
    SET completed_trades = completed_trades + 1
    WHERE id = NEW.receiver_id;
    
    -- Update items availability
    UPDATE items
    SET is_available = false
    WHERE id = NEW.offered_item_id OR id = NEW.requested_item_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update completed trades count when a trade is accepted
CREATE TRIGGER update_completed_trades_on_accept
AFTER UPDATE ON trades
FOR EACH ROW
EXECUTE FUNCTION update_completed_trades();