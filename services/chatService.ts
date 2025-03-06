import { supabase } from '@/lib/supabase';
import { Tables } from '@/database.types';
import { uploadFile, getSupabaseFileUrl } from '@/services/imageservice';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';

export type ChatRoom = Tables<'chat_rooms'> & {
  participants: Tables<'profiles'>[];
  last_message?: Tables<'messages'> & {
    sender: Tables<'profiles'>;
  };
};

export type Message = Tables<'messages'> & {
  sender: Tables<'profiles'>;
  is_deleted?: boolean;
  content: string | null;
  message_type: 'text' | 'image' | 'video' | 'voice' | 'deleted' | 'gif' | 'emoji';
  duration?: number;
  gif_url?: string;
};

export const chatService = {
  // Create or get existing chat room between two users
  async createOrGetChatRoom(userId1: string, userId2: string): Promise<{ success: boolean; chatRoom?: ChatRoom; error?: string }> {
    try {
      // Check if chat room already exists
      const { data: existingRoom } = await supabase
        .from('chat_rooms')
        .select(`
          *,
          participants:chat_room_participants(user:profiles(*))
        `)
        .contains('participant_ids', [userId1, userId2])
        .single();

      if (existingRoom) {
        return { success: true, chatRoom: existingRoom as ChatRoom };
      }

      // Create new chat room
      const { data: newRoom, error: roomError } = await supabase
        .from('chat_rooms')
        .insert({
          participant_ids: [userId1, userId2],
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Add participants
      await supabase.from('chat_room_participants').insert([
        { chat_room_id: newRoom.id, user_id: userId1 },
        { chat_room_id: newRoom.id, user_id: userId2 },
      ]);

      const { data: roomWithParticipants } = await supabase
        .from('chat_rooms')
        .select(`
          *,
          participants:chat_room_participants(user:profiles(*))
        `)
        .eq('id', newRoom.id)
        .single();

      return { success: true, chatRoom: roomWithParticipants as ChatRoom };
    } catch (error) {
      console.error('Error creating/getting chat room:', error);
      return { success: false, error: 'Failed to create or get chat room' };
    }
  },

  // Send a message
  async sendMessage(
    chatRoomId: string, 
    senderId: string, 
    content: string | null,
    mediaUri?: string,
    messageType: 'text' | 'image' | 'video' | 'voice' | 'gif' | 'emoji' = 'text',
    duration?: number,
    gifUrl?: string
  ): Promise<{ success: boolean; message?: Message; error?: string }> {
    try {
      // Create the message object
      const messageData = {
        chat_room_id: chatRoomId,
        sender_id: senderId,
        content,
        media_uri: mediaUri,
        message_type: messageType,
        duration,
        created_at: new Date().toISOString(),
        gif_url: gifUrl,
      };

      // First insert the message - using a more direct approach to avoid method chaining issues
      const insertResult = await supabase
        .from('messages')
        .insert(messageData);
      
      if (insertResult.error) {
        throw insertResult.error;
      }
      
      // Generate a unique identifier for this message to avoid query issues
      const timestamp = new Date().toISOString();
      
      // Then fetch the inserted message with a separate query
      // Use a more reliable approach that doesn't rely on content matching
      const { data: messages, error: fetchError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles(*)
        `)
        .eq('chat_room_id', chatRoomId)
        .eq('sender_id', senderId)
        .eq('message_type', messageType)
        .gte('created_at', new Date(Date.now() - 10000).toISOString()) // Messages from the last 10 seconds
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) {
        throw fetchError;
      }
      
      if (!messages || messages.length === 0) {
        throw new Error('Message was inserted but could not be retrieved');
      }

      return { success: true, message: messages[0] as Message };
    } catch (error) {
      console.error('Error sending message:', error);
      return { success: false, error: 'Failed to send message' };
    }
  },

  // Get messages for a chat room
  async getChatMessages(chatRoomId: string): Promise<{ success: boolean; messages?: Message[]; error?: string }> {
    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles(*),
          read_status:message_read_status(*)
        `)
        .eq('chat_room_id', chatRoomId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { success: true, messages: messages as Message[] };
    } catch (error) {
      console.error('Error fetching messages:', error);
      return { success: false, error: 'Failed to fetch messages' };
    }
  },

  // Get user's chat rooms
  async getUserChatRooms(userId: string): Promise<{ success: boolean; chatRooms?: ChatRoom[]; error?: string }> {
    try {
      // First, get all chat rooms where the user is a participant
      const { data: chatRooms, error } = await supabase
        .from('chat_rooms')
        .select(`
          *,
          participants:chat_room_participants(
            user:profiles(*)
          )
        `)
        .contains('participant_ids', [userId])
        .order('updated_at', { ascending: false });

      if (error) throw error;

      console.log('Fetched chat rooms with participants:', chatRooms);

      if (!chatRooms || chatRooms.length === 0) {
        return { success: true, chatRooms: [] };
      }

      // Get the latest message for each chat room in a single query
      const chatRoomIds = chatRooms.map(room => room.id);
      
      // This query gets the latest message for each chat room
      const { data: latestMessages, error: messagesError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles(*),
          chat_room_id
        `)
        .in('chat_room_id', chatRoomIds)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      // Create a map of chat room ID to its latest message
      const latestMessageMap: Record<string, any> = {};
      if (latestMessages) {
        latestMessages.forEach(message => {
          // Only set if this is the first (latest) message we've seen for this room
          if (!latestMessageMap[message.chat_room_id]) {
            latestMessageMap[message.chat_room_id] = message;
          }
        });
      }

      // Transform the chat rooms data to include participants and latest message
      const transformedChatRooms = chatRooms.map(room => {
        // Extract participants from the nested structure
        const participants = room.participants.map((p: any) => p.user);
        console.log('Participants for room', room.id, ':', participants);
        
        const unreadCount = room.unread_count || 0;
        
        return {
          ...room,
          participants,
          last_message: latestMessageMap[room.id] || null,
          unread_count: unreadCount
        };
      });

      return { success: true, chatRooms: transformedChatRooms as ChatRoom[] };
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
      return { success: false, error: 'Failed to fetch chat rooms' };
    }
  },

  // Update uploadChatMedia to use imageService
  async uploadChatMedia(file: any, chatRoomId: string): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const isImage = file.type?.startsWith('image') || file.uri.match(/\.(jpg|jpeg|png|gif)$/i);
      const isVideo = file.type?.startsWith('video') || file.uri.match(/\.(mp4|mov|avi|wmv)$/i);
      
      const folderName = isImage ? 'chatImages' : isVideo ? 'chatVideos' : 'chatFiles';
      
      const result = await uploadFile(folderName, file.uri, isImage);
      
      if (!result.success || !result.data) {
        throw new Error(result.msg || 'Upload failed');
      }

      const url = getSupabaseFileUrl(result.data);
      return { success: true, url };
    } catch (error) {
      console.error('Error uploading media:', error);
      return { success: false, error: 'Failed to upload media' };
    }
  },

  async getChatRoomDetails(chatRoomId: string): Promise<{ 
    success: boolean; 
    chatRoom?: ChatRoom; 
    error?: string 
  }> {
    try {
      const { data: chatRoom, error } = await supabase
        .from('chat_rooms')
        .select(`
          *,
          participants:chat_room_participants(user:profiles(*))
        `)
        .eq('id', chatRoomId)
        .single();

      if (error) throw error;

      const unreadCount = chatRoom.unread_count || 0;

      return { success: true, chatRoom: chatRoom as ChatRoom };
    } catch (error) {
      console.error('Error fetching chat room details:', error);
      return { success: false, error: 'Failed to fetch chat room details' };
    }
  },

  // Add this new method to chatService
  async deleteMessage(messageId: string): Promise<{ success: boolean }> {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ 
          content: '[deleted]', 
          media_uri: null,
          is_deleted: true 
        })
        .eq('id', messageId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting message:', error);
      return { success: false };
    }
  },

  // Add this subscription to handle real-time message updates
  async subscribeToMessages(chatRoomId: string, callback: (payload: any) => void) {
    return supabase
      .channel('messages')
      .on('postgres_changes', 
        { 
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public', 
          table: 'messages', 
          filter: `chat_room_id=eq.${chatRoomId}` 
        },
        callback
      )
      .subscribe();
  },

  async uploadVoiceMessage(uri: string): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      console.log('Starting voice message upload:', uri);
      
      // Generate a unique filename for the voice message
      const filename = `voice_${Date.now()}.m4a`;
      
      // Upload the file directly using the URI string
      const result = await uploadFile('voiceMessages', uri, false);
      
      if (!result.success || !result.data) {
        console.error('Voice upload failed:', result.msg);
        throw new Error(result.msg || 'Upload failed');
      }

      const url = getSupabaseFileUrl(result.data);
      console.log('Voice message uploaded successfully:', url);
      return { success: true, url };
    } catch (error) {
      console.error('Error uploading voice message:', error);
      return { success: false, error: 'Failed to upload voice message' };
    }
  },

  // Add a new method to search for GIFs
  async searchGifs(query: string): Promise<{ success: boolean; results?: any[]; error?: string }> {
    try {
      // Using Giphy API - you'll need to replace 'YOUR_GIPHY_API_KEY' with an actual API key
      const GIPHY_API_KEY = 'hpvZycW22qCjn5cRM1xtWB8NKq4dQ2My'; // Public beta key for testing
      const response = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=g`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch GIFs');
      }
      
      const data = await response.json();
      return { success: true, results: data.data };
    } catch (error) {
      console.error('Error searching GIFs:', error);
      return { success: false, error: 'Failed to search GIFs' };
    }
  },

  // Add a method to get trending GIFs
  async getTrendingGifs(): Promise<{ success: boolean; results?: any[]; error?: string }> {
    try {
      const GIPHY_API_KEY = 'hpvZycW22qCjn5cRM1xtWB8NKq4dQ2My'; // Public beta key for testing
      const response = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=g`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch trending GIFs');
      }
      
      const data = await response.json();
      return { success: true, results: data.data };
    } catch (error) {
      console.error('Error fetching trending GIFs:', error);
      return { success: false, error: 'Failed to fetch trending GIFs' };
    }
  },

  async markMessagesAsRead(chatRoomId: string, userId: string): Promise<{ success: boolean }> {
    try {
      await supabase.rpc('mark_messages_as_read', {
        p_chat_room_id: chatRoomId,
        p_user_id: userId
      });
      return { success: true };
    } catch (error) {
      console.error('Error marking messages as read:', error);
      return { success: false };
    }
  },
};

export default chatService; 