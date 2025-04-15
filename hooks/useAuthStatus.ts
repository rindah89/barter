import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import useProfile from './useProfile';
import { supabase } from '../lib/supabase';

export type AuthStatus = 
  | 'loading' 
  | 'authenticated' 
  | 'unauthenticated' 
  | 'profile_loading' 
  | 'profile_error' 
  | 'ready';

/**
 * Hook to comprehensively check authentication status including profile loading
 * This provides a unified way to track the complete authentication flow
 */
export default function useAuthStatus() {
  const { user, session, isLoading } = useAuth();
  const { profile, loading: profileLoading, error: profileError, refreshProfile } = useProfile();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Check if session is valid with Supabase
  const verifySession = async () => {
    if (!session) return false;
    
    try {
      console.log('[useAuthStatus] Verifying session with Supabase');
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[useAuthStatus] Session verification error:', error);
        return false;
      }
      
      return !!data.session;
    } catch (err) {
      console.error('[useAuthStatus] Error verifying session:', err);
      return false;
    }
  };

  // Force refresh user data
  const refreshUserData = async () => {
    try {
      if (!user || !session) {
        console.log('[useAuthStatus] No user or session, skipping refresh');
        return false;
      }
      
      console.log('[useAuthStatus] Refreshing user data from Supabase');
      const { data, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error('[useAuthStatus] Error refreshing user data:', error);
        return false;
      }
      
      if (data?.user) {
        console.log('[useAuthStatus] User data refreshed successfully');
        // Profile refresh happens through the useProfile hook
        await refreshProfile();
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('[useAuthStatus] Error in refreshUserData:', err);
      return false;
    }
  };

  // Determine comprehensive authentication status
  useEffect(() => {
    const determineStatus = async () => {
      // Still loading auth state
      if (isLoading) {
        console.log('[useAuthStatus] Auth still loading');
        setStatus('loading');
        return;
      }

      // Not authenticated
      if (!session || !user) {
        console.log('[useAuthStatus] Not authenticated - no session or user');
        setStatus('unauthenticated');
        return;
      }

      // Verify session is still valid
      const isSessionValid = await verifySession();
      if (!isSessionValid) {
        console.log('[useAuthStatus] Session validation failed');
        setStatus('unauthenticated');
        return;
      }

      // Authentication looks good, now check profile
      if (profileLoading) {
        console.log('[useAuthStatus] Profile is still loading');
        setStatus('profile_loading');
        return;
      }

      if (profileError) {
        console.error('[useAuthStatus] Profile error:', profileError);
        setStatus('profile_error');
        return;
      }

      if (!profile) {
        console.log('[useAuthStatus] No profile data, attempting to refresh');
        // Try to refresh the profile
        await refreshProfile();
        
        // Still no profile after refresh, mark as error
        if (!profile) {
          console.error('[useAuthStatus] Profile still missing after refresh');
          setStatus('profile_error');
          return;
        }
      }

      // Everything is good!
      console.log('[useAuthStatus] Authentication and profile ready');
      setStatus('ready');
      setLastChecked(new Date());
    };

    determineStatus();
  }, [isLoading, session, user, profileLoading, profileError, profile]);

  return {
    status,
    user,
    profile,
    lastChecked,
    refreshUserData,
    refreshProfile,
  };
} 