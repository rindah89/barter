import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { Database } from '../database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface UseProfileResult {
  profile: Profile | null;
  loading: boolean;
  error: Error | null;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
}

export default function useProfile(): UseProfileResult {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = async () => {
    if (!user || !user.id) {
      console.log('[useProfile] No user or user.id, skipping profile fetch');
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`[useProfile] Fetching profile for user ID: ${user.id}`);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('[useProfile] Error in supabase query:', error);
        throw error;
      }

      if (!data) {
        console.warn('[useProfile] No profile found for user ID:', user.id);
        // Create a default profile if none exists
        await createDefaultProfile(user.id);
        return;
      }

      console.log('[useProfile] Profile loaded successfully');
      setProfile(data as Profile);
    } catch (err) {
      console.error('[useProfile] Error fetching profile:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  // Create a default profile if none exists
  const createDefaultProfile = async (userId: string) => {
    try {
      console.log('[useProfile] Creating default profile for user ID:', userId);
      
      const defaultProfile = {
        id: userId,
        name: 'New User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      const { error } = await supabase
        .from('profiles')
        .insert(defaultProfile);
      
      if (error) {
        console.error('[useProfile] Error creating default profile:', error);
        throw error;
      }
      
      // Fetch the newly created profile
      console.log('[useProfile] Default profile created, fetching it');
      await fetchProfile();
    } catch (err) {
      console.error('[useProfile] Error in createDefaultProfile:', err);
      setError(err as Error);
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user || !user.id) {
      console.error('[useProfile] Cannot update profile: No user or user ID');
      return { error: new Error('User not authenticated') };
    }

    try {
      console.log('[useProfile] Updating profile for user ID:', user.id);
      
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        console.error('[useProfile] Error updating profile:', error);
        throw error;
      }

      // Refresh the profile after update
      console.log('[useProfile] Profile updated, refreshing');
      await fetchProfile();
      return { error: null };
    } catch (err) {
      console.error('[useProfile] Error in updateProfile:', err);
      return { error: err as Error };
    }
  };

  // Fetch profile on initial load and when user changes
  useEffect(() => {
    if (user) {
      console.log('[useProfile] User changed, fetching profile');
      fetchProfile();
    } else {
      console.log('[useProfile] No user available, clearing profile');
      setProfile(null);
      setLoading(false);
    }
  }, [user]);

  return {
    profile,
    loading,
    error,
    refreshProfile: fetchProfile,
    updateProfile,
  };
}