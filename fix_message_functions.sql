-- Fix for the database trigger functions related to chat messages
-- This script addresses:
-- 1. The "argument of CASE/WHEN must not return a set" error
-- 2. The "missing FROM-clause entry for table 'new'" error
-- 3. The "new row violates row-level security policy for table" error
-- 4. The "operator does not exist: text = uuid" error

-- Drop existing triggers to avoid conflicts
DROP TRIGGER IF EXISTS create_message_read_status_trigger ON public.messages;
DROP TRIGGER IF EXISTS update_chat_room_last_message_at_trigger ON public.messages;

-- First, let's fix the update_chat_room_last_message_at function
-- Add SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.update_chat_room_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the last_message_at field in the chat_rooms table
    UPDATE public.chat_rooms
    SET last_message_at = NEW.created_at
    WHERE id = NEW.chat_room_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Now, let's fix the create_message_read_status function with a simpler approach
CREATE OR REPLACE FUNCTION public.create_message_read_status()
RETURNS TRIGGER AS $$
DECLARE
    room_participants uuid[];
BEGIN
    -- Get the participant_ids array directly
    SELECT participant_ids INTO room_participants
    FROM public.chat_rooms
    WHERE id = NEW.chat_room_id;

    -- Insert read status records for all participants
    INSERT INTO public.message_read_status (
        message_id,
        user_id,
        is_read,
        created_at,
        read_at
    )
    SELECT
        NEW.id,
        participant::uuid,
        CASE 
            WHEN participant::uuid = NEW.sender_id THEN true 
            ELSE false 
        END,
        NOW(),
        CASE 
            WHEN participant::uuid = NEW.sender_id THEN NOW()
            ELSE NULL 
        END
    FROM unnest(room_participants) AS participant;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the triggers
CREATE TRIGGER update_chat_room_last_message_at_trigger
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_chat_room_last_message_at();

CREATE TRIGGER create_message_read_status_trigger
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.create_message_read_status();

-- Now, let's also fix the mark_messages_as_read function
-- Add SECURITY DEFINER to bypass RLS and fix type casting
CREATE OR REPLACE FUNCTION public.mark_messages_as_read(p_chat_room_id text, p_user_id text)
RETURNS void AS $$
BEGIN
    -- Update the read status for all messages in the chat room for this user
    UPDATE public.message_read_status
    SET is_read = true, read_at = NOW()
    WHERE message_id IN (
        SELECT id FROM public.messages WHERE chat_room_id = p_chat_room_id::uuid
    )
    AND user_id = p_user_id::uuid
    AND is_read = false;
    
    -- Update the unread_count in the chat_rooms table
    UPDATE public.chat_rooms
    SET unread_count = 0
    WHERE id = p_chat_room_id::uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies for the message_read_status table if needed
DO $$
BEGIN
    -- Enable RLS on message_read_status table if not already enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'message_read_status' 
        AND rowsecurity = true
    ) THEN
        ALTER TABLE public.message_read_status ENABLE ROW LEVEL SECURITY;
    END IF;

    -- Create policy if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'message_read_status'
        AND policyname = 'Allow all operations for authenticated users'
    ) THEN
        CREATE POLICY "Allow all operations for authenticated users" 
        ON public.message_read_status 
        FOR ALL 
        TO authenticated 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$; 