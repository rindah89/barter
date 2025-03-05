import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Message } from '../lib/supabase';
import { useAuth } from './useAuth';

export type MessageWithSender = Message & {
  sender: {
    name: string;
    avatar_url: string;
  };
};

export function useMessages(tradeId: string | null) {
  const { userId } = useAuth();
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tradeId || !userId) {
      setLoading(false);
      return;
    }

    // Initial fetch of messages
    async function loadMessages() {
      try {
        const { data, error: fetchError } = await supabase
          .from('messages')
          .select(`
            *,
            sender:sender_id(name, avatar_url)
          `)
          .eq('trade_id', tradeId)
          .order('created_at', { ascending: true });

        if (fetchError) throw fetchError;
        
        setMessages(data || []);
      } catch (err) {
        console.error('Error loading messages:', err);
        setError('Failed to load messages');
      } finally {
        setLoading(false);
      }
    }

    loadMessages();

    // Set up real-time subscription for new messages
    const subscription = supabase
      .channel(`messages:trade_id=eq.${tradeId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `trade_id=eq.${tradeId}`
      }, async (payload) => {
        // Fetch the complete message with sender info
        const { data, error } = await supabase
          .from('messages')
          .select(`
            *,
            sender:sender_id(name, avatar_url)
          `)
          .eq('id', payload.new.id)
          .single();

        if (!error && data) {
          setMessages(prev => [...prev, data]);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [tradeId, userId]);

  // Send a new message
  const sendMessage = async (content: string) => {
    if (!userId || !tradeId) return { success: false, error: 'Missing user ID or trade ID' };

    try {
      const newMessage = {
        trade_id: tradeId,
        sender_id: userId,
        content,
      };

      const { error } = await supabase
        .from('messages')
        .insert(newMessage);

      if (error) throw error;

      return { success: true };
    } catch (err) {
      console.error('Error sending message:', err);
      return { success: false, error: 'Failed to send message' };
    }
  };

  return {
    messages,
    loading,
    error,
    sendMessage,
  };
}