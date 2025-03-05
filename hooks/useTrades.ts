import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

export interface Trade {
  id: string;
  created_at: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  initiator_id: string;
  receiver_id: string;
  initiator_items: string[];
  receiver_items: string[];
  initiator_profile?: {
    username: string;
    avatar_url?: string;
  };
  receiver_profile?: {
    username: string;
    avatar_url?: string;
  };
}

export function useTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchTrades = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('trades')
          .select(`
            *,
            initiator_profile:profiles!initiator_id(username, avatar_url),
            receiver_profile:profiles!receiver_id(username, avatar_url)
          `)
          .or(`initiator_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        setTrades(data || []);
      } catch (err) {
        console.error('Error fetching trades:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchTrades();

    // Set up realtime subscription
    const tradesSubscription = supabase
      .channel('trades_changes')
      .on('postgres_changes', 
        {
          event: '*',
          schema: 'public',
          table: 'trades',
          filter: `initiator_id=eq.${user.id},receiver_id=eq.${user.id}`
        }, 
        () => {
          fetchTrades();
        }
      )
      .subscribe();

    return () => {
      tradesSubscription.unsubscribe();
    };
  }, [user]);

  return { trades, loading, error };
} 