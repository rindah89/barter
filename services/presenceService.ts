import { supabase } from '@/lib/supabase';

export const presenceService = {
  // Update user's online status
  async updatePresence(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.rpc('upsert_user_presence', {
        user_id: userId
      });
      
      if (error) throw error;
      
      return { success: true };
    } catch (error) {
      console.error('Error updating presence:', error);
      return { success: false, error: 'Failed to update presence' };
    }
  },
  
  // Mark user as offline
  async markOffline(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.rpc('mark_user_offline', {
        user_id: userId
      });
      
      if (error) throw error;
      
      return { success: true };
    } catch (error) {
      console.error('Error marking user offline:', error);
      return { success: false, error: 'Failed to mark user offline' };
    }
  },
  
  // Check if a user is online
  async isUserOnline(userId: string): Promise<{ success: boolean; isOnline: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('is_user_online', {
        user_id: userId
      });
      
      if (error) throw error;
      
      return { success: true, isOnline: data || false };
    } catch (error) {
      console.error('Error checking if user is online:', error);
      return { success: false, isOnline: false, error: 'Failed to check user online status' };
    }
  },
  
  // Get user's last seen time
  async getUserLastSeen(userId: string): Promise<{ success: boolean; lastSeen?: string; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('user_presence')
        .select('last_seen')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      
      return { success: true, lastSeen: data?.last_seen };
    } catch (error) {
      console.error('Error getting user last seen:', error);
      return { success: false, error: 'Failed to get user last seen time' };
    }
  },
  
  // Subscribe to a user's presence changes
  subscribeToUserPresence(userId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`presence:${userId}`)
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'user_presence', 
          filter: `id=eq.${userId}` 
        },
        callback
      )
      .subscribe();
  }
};

export default presenceService; 