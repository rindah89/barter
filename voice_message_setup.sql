-- Ensure message_type has the 'voice' type as an allowed value
-- First, let's check if the message_type column has any constraints
DO $$
BEGIN
  -- If there's a check constraint on message_type, we'll modify it to include 'voice'
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_schema = 'public' 
    AND constraint_table = 'messages' 
    AND constraint_name LIKE '%message_type%'
  ) THEN
    -- Get the constraint name
    DECLARE
      constraint_name text;
    BEGIN
      SELECT constraint_name INTO constraint_name
      FROM information_schema.check_constraints 
      WHERE constraint_schema = 'public' 
      AND constraint_table = 'messages' 
      AND constraint_name LIKE '%message_type%'
      LIMIT 1;
      
      -- Drop the existing constraint
      EXECUTE 'ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS ' || constraint_name;
      
      -- Add the new constraint with 'voice' included
      ALTER TABLE public.messages
      ADD CONSTRAINT messages_message_type_check
      CHECK (message_type IN ('text', 'image', 'video', 'voice', 'deleted', 'gif', 'emoji'));
    END;
  ELSE
    -- If no constraint exists, add one
    ALTER TABLE public.messages
    ADD CONSTRAINT messages_message_type_check
    CHECK (message_type IN ('text', 'image', 'video', 'voice', 'deleted', 'gif', 'emoji'));
  END IF;
END
$$;

-- Ensure the duration column exists and is of the correct type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages' 
    AND column_name = 'duration'
  ) THEN
    ALTER TABLE public.messages
    ADD COLUMN duration numeric NULL;
  END IF;
END
$$;

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