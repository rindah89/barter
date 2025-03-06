import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

export function useAuth() {
  console.log('[useAuth] Hook called');
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    console.log('[useAuth] useEffect running');
    
    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('[useAuth] Getting initial session');
        const { data } = await supabase.auth.getSession();
        console.log('[useAuth] Got session:', { hasSession: !!data.session });
        setSession(data.session);
        setUserId(data.session?.user?.id || null);
        setLoading(false);
      } catch (error) {
        console.error('[useAuth] Error getting initial session:', error);
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    console.log('[useAuth] Setting up auth state change listener');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log('[useAuth] Auth state changed:', { event: _event, hasSession: !!session });
        setSession(session);
        setUserId(session?.user?.id || null);
        setLoading(false);
      }
    );

    return () => {
      console.log('[useAuth] Cleaning up auth state change listener');
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    console.log('[useAuth] Signing out');
    try {
      await supabase.auth.signOut();
      console.log('[useAuth] Signed out successfully');
    } catch (error) {
      console.error('[useAuth] Error signing out:', error);
    }
  };

  console.log('[useAuth] Returning auth state:', { hasSession: !!session, loading, hasUserId: !!userId });
  return {
    session,
    userId,
    loading,
    signOut,
    isAuthenticated: !!session,
  };
}