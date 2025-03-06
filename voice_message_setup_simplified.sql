-- Add voice message support to the database

-- First, ensure the duration column exists
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS duration numeric NULL;

-- Drop existing constraint if it exists (will fail silently if it doesn't exist)
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;

-- Add the constraint with voice included
ALTER TABLE public.messages
ADD CONSTRAINT messages_message_type_check
CHECK (message_type IN ('text', 'image', 'video', 'voice', 'deleted', 'gif', 'emoji'));

-- Create a storage bucket for voice messages if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
SELECT 'voiceMessages', 'voiceMessages', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'voiceMessages'
);

-- Set up storage policy to allow authenticated users to upload voice messages
INSERT INTO storage.policies (name, definition, bucket_id)
SELECT 
  'Voice Messages Upload Policy', 
  '(auth.role() = ''authenticated'')', 
  'voiceMessages'
WHERE NOT EXISTS (
  SELECT 1 FROM storage.policies 
  WHERE bucket_id = 'voiceMessages' AND name = 'Voice Messages Upload Policy'
);

-- Set up storage policy to allow public access to voice messages
INSERT INTO storage.policies (name, definition, bucket_id)
SELECT 
  'Voice Messages Public Access Policy', 
  '(true)', 
  'voiceMessages'
WHERE NOT EXISTS (
  SELECT 1 FROM storage.policies 
  WHERE bucket_id = 'voiceMessages' AND name = 'Voice Messages Public Access Policy'
);

-- Create a function to update the last_message_at field in chat_rooms when a new message is sent
CREATE OR REPLACE FUNCTION public.update_chat_room_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_rooms
  SET last_message_at = NEW.created_at
  WHERE id = NEW.chat_room_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to call the function when a new message is inserted
DROP TRIGGER IF EXISTS update_chat_room_last_message_at_trigger ON public.messages;
CREATE TRIGGER update_chat_room_last_message_at_trigger
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_chat_room_last_message_at();

-- Create a function to handle message read status
CREATE OR REPLACE FUNCTION public.create_message_read_status()
RETURNS TRIGGER AS $$
DECLARE
  participant_id text;
BEGIN
  -- For each participant in the chat room (except the sender), create a read status record
  FOR participant_id IN 
    SELECT user_id FROM public.chat_room_participants 
    WHERE chat_room_id = NEW.chat_room_id AND user_id != NEW.sender_id
  LOOP
    INSERT INTO public.message_read_status (
      message_id, 
      user_id, 
      is_read, 
      created_at
    ) VALUES (
      NEW.id, 
      participant_id, 
      false, 
      NOW()
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to call the function when a new message is inserted
DROP TRIGGER IF EXISTS create_message_read_status_trigger ON public.messages;
CREATE TRIGGER create_message_read_status_trigger
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.create_message_read_status(); 