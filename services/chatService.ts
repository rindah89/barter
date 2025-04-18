import { supabase } from '@/lib/supabase';
import { Tables } from '@/database.types';
import { uploadFile, getSupabaseFileUrl } from '@/services/imageservice';
import * as FileSystem from 'expo-file-system';

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
  metadata?: any;
};

export const chatService = {
  // Create or get existing chat room between two users
  async createOrGetChatRoom(userId1: string, userId2: string): Promise<{ success: boolean; chatRoom?: ChatRoom; error?: string }> {
    try {
      // Check if chat room already exists
      const { data: existingRoomData } = await supabase
        .from('chat_rooms')
        .select('*')
        .contains('participant_ids', [userId1, userId2])
        .single();

      if (existingRoomData) {
        // Fetch participants separately
        const { data: participants } = await supabase
          .from('profiles')
          .select('*')
          .in('id', [userId1, userId2]);
          
        // Construct the chat room with participants
        const existingRoom: ChatRoom = {
          ...existingRoomData,
          participants: participants || [],
        };
        
        return { success: true, chatRoom: existingRoom };
      }

      // Create new chat room without chaining select
      const { error: roomError } = await supabase
        .from('chat_rooms')
        .insert({
          participant_ids: [userId1, userId2],
          created_at: new Date().toISOString(),
        });

      if (roomError) throw roomError;
      
      // Fetch the newly created room
      const { data: newRoom, error: fetchError } = await supabase
        .from('chat_rooms')
        .select('*')
        .contains('participant_ids', [userId1, userId2])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (fetchError) throw fetchError;

      // Add participants
      await supabase.from('chat_room_participants').insert([
        { chat_room_id: newRoom.id, user_id: userId1 },
        { chat_room_id: newRoom.id, user_id: userId2 },
      ]);

      // Fetch participants separately
      const { data: participants } = await supabase
        .from('profiles')
        .select('*')
        .in('id', [userId1, userId2]);
        
      // Construct the chat room with participants
      const roomWithParticipants: ChatRoom = {
        ...newRoom,
        participants: participants || [],
      };

      return { success: true, chatRoom: roomWithParticipants };
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
    gifUrl?: string,
    metadata?: any
  ): Promise<{ success: boolean; message?: Message; error?: string }> {
    try {
      // First insert the message
      const messageData = {
        chat_room_id: chatRoomId,
        sender_id: senderId,
        content,
        media_uri: mediaUri,
        message_type: messageType,
        duration,
        created_at: new Date().toISOString(),
        metadata: metadata || null,
      };
      
      // Insert the message without chaining select
      const { error: insertError } = await supabase
        .from('messages')
        .insert(messageData);

      if (insertError) throw insertError;
      
      // Fetch the inserted message in a separate query
      const { data: fetchedMessage, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_room_id', chatRoomId)
        .eq('sender_id', senderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (fetchError) throw fetchError;

      // Fetch the sender profile separately
      const { data: senderProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', senderId)
        .single();
        
      if (profileError) throw profileError;
      
      // Combine the message and sender profile
      const message: Message = {
        ...fetchedMessage,
        sender: senderProfile,
        metadata: metadata || null,
      };

      return { success: true, message };
    } catch (error) {
      console.error('Error sending message:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to send message' };
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
      // Get the chat room basic details
      const { data: chatRoomData, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('id', chatRoomId)
        .single();

      if (error) throw error;
      
      // Get the participant IDs from the chat room
      const participantIds = chatRoomData.participant_ids || [];
      
      // Fetch participants separately
      const { data: participants, error: participantsError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', participantIds);
        
      if (participantsError) throw participantsError;
      
      // Construct the chat room with participants
      const chatRoom: ChatRoom = {
        ...chatRoomData,
        participants: participants || [],
        unread_count: chatRoomData.unread_count || 0
      };

      return { success: true, chatRoom };
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

  /**
   * Finds an existing chat room with the EXACT set of participants or creates a new one.
   * Uses the `create_or_get_chat_room` PostgreSQL function via RPC.
   * @param participantIds - An array of user UUIDs for the chat room.
   * @returns {Promise<{ success: boolean; roomId?: string; error?: string }>} The chat room ID.
   */
  async getOrCreateChatRoom(participantIds: string[]): Promise<{ success: boolean; roomId?: string; error?: string }> {
    if (!participantIds || participantIds.length < 2) {
      return { success: false, error: 'At least two participants are required.' };
    }
    try {
      // Ensure IDs are unique before calling RPC
      const uniqueParticipantIds = [...new Set(participantIds)];
      if (uniqueParticipantIds.length < 2) {
        return { success: false, error: 'At least two unique participants are required.' };
      }
      
      console.log('[getOrCreateChatRoom] Calling RPC with participants:', uniqueParticipantIds);
      const { data, error } = await supabase.rpc('create_or_get_chat_room', {
        p_participant_ids: uniqueParticipantIds,
      });

      if (error) throw error;

      if (!data) {
        throw new Error('Failed to get or create chat room ID from RPC.');
      }

      console.log('[getOrCreateChatRoom] RPC returned room ID:', data);
      return { success: true, roomId: data };

    } catch (error: any) {
      console.error('[getOrCreateChatRoom] Error:', error);
      return { success: false, error: error.message || 'Failed to get or create chat room' };
    }
  },

  /**
   * Fetches details for a specific chat room, including its participants.
   * @param chatRoomId - The ID of the chat room.
   * @returns {Promise<{ success: boolean; chatRoom?: ChatRoom; error?: string }>} The chat room details.
   */
  async getChatRoomDetails(chatRoomId: string): Promise<{ success: boolean; chatRoom?: ChatRoom; error?: string }> {
    if (!chatRoomId) return { success: false, error: 'Chat Room ID is required.' };
    try {
      const { data: roomData, error: roomError } = await supabase
        .from('chat_rooms')
        .select('*, participants:chat_room_participants!inner(profile:profiles(*))') // Fetch participants via junction table
        .eq('id', chatRoomId)
        .single();

      if (roomError) throw roomError;
      if (!roomData) return { success: false, error: 'Chat room not found.' };

      // Extract and structure participant profiles
      const participants = roomData.participants?.map((p: any) => p.profile).filter(Boolean) || [];

      const chatRoom: ChatRoom = {
        ...roomData,
        participants: participants,
      };

      return { success: true, chatRoom };
    } catch (error: any) {
      console.error('[getChatRoomDetails] Error:', error);
      return { success: false, error: error.message || 'Failed to fetch chat room details' };
    }
  },

  /**
   * Gets all chat rooms for a specific user, including participants and the last message.
   * @param userId - The ID of the user.
   * @returns {Promise<{ success: boolean; chatRooms?: ChatRoom[]; error?: string }>} List of chat rooms.
   */
  async getUserChatRooms(userId: string): Promise<{ success: boolean; chatRooms?: ChatRoom[]; error?: string }> {
    try {
      // Fetch rooms where user is a participant, joining participant profiles
      const { data: roomsData, error: roomsError } = await supabase
        .from('chat_rooms')
        .select(`
          *,\
          participants:chat_room_participants!inner(\
            profile:profiles(*)\
          )\
        `)
        .eq('participants.user_id', userId) // Filter rooms where the user is a participant
        .order('last_message_at', { ascending: false, nullsFirst: false }); // Order by last message time

      if (roomsError) throw roomsError;
      if (!roomsData) return { success: true, chatRooms: [] };
      
      console.log(`[getUserChatRooms] Found ${roomsData.length} initial rooms for user ${userId}`);

      // Fetch the latest message for each room (more efficient approach might be needed for many rooms)
      const roomIds = roomsData.map(r => r.id);
      if (roomIds.length === 0) return { success: true, chatRooms: [] };

      const { data: latestMessages, error: messagesError } = await supabase
        .from('messages')
        .select(`
          *,\
          sender:profiles(*)\
        `)
        .in('chat_room_id', roomIds)
        // Use a window function partition to get only the latest message per room
        // This is more complex and might require an RPC call or view if performance is critical.
        // Simple approach for now: fetch recent messages and map.
        .order('created_at', { ascending: false })
        .limit(roomIds.length * 5); // Fetch a few recent messages per room to find the latest

      if (messagesError) throw messagesError;

      // Create a map of the latest message for each room
      const latestMessageMap = new Map<string, Message>();
      if (latestMessages) {
        for (const msg of latestMessages) {
          if (!latestMessageMap.has(msg.chat_room_id)) {
            latestMessageMap.set(msg.chat_room_id, msg as Message);
          }
        }
      }
      
      // Map the data
      const chatRooms: ChatRoom[] = roomsData.map((room) => {
        const participants = room.participants?.map((p: any) => p.profile).filter(Boolean) || [];
        return {
          ...room,
          participants: participants,
          last_message: latestMessageMap.get(room.id),
        };
      }).sort((a, b) => { // Ensure final sort by last message time
        const timeA = a.last_message ? new Date(a.last_message.created_at).getTime() : new Date(a.updated_at || a.created_at).getTime();
        const timeB = b.last_message ? new Date(b.last_message.created_at).getTime() : new Date(b.updated_at || b.created_at).getTime();
        return timeB - timeA;
      });

      console.log(`[getUserChatRooms] Returning ${chatRooms.length} processed rooms`);
      return { success: true, chatRooms };

    } catch (error: any) {
      console.error('[getUserChatRooms] Error:', error);
      return { success: false, error: error.message || 'Failed to fetch chat rooms' };
    }
  },
};

export default chatService; 