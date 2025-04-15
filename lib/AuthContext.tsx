import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSegments, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { User } from '@supabase/supabase-js';
import {
  getCurrentSession,
  signInWithEmail,
  signUpWithEmail,
  refreshSession,
  signOut as expoSignOut,
  getDeepLinkRedirectUri
} from './ExpoAuthSession';

// Update the auth context type to focus on email auth
interface AuthContextType {
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: Error }>;
  signUp: (email: string, password: string, metadata?: any) => Promise<{ success: boolean; error?: Error; confirmationRequired?: boolean }>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  session: string | null;
  isLoading: boolean;
  user: User | null;
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  signIn: async () => ({ success: false }),
  signUp: async () => ({ success: false }),
  signOut: async () => {},
  refreshToken: async () => false,
  session: null,
  isLoading: true,
  user: null,
});

// Storage key for the session token
const SESSION_KEY = 'auth-session';

// Helper function to store the session token securely
async function setStorageItemAsync(key: string, value: string | null) {
  if (Platform.OS === 'web') {
    try {
      if (value === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.error('[AuthContext] Local storage is unavailable:', e);
    }
  } else {
    if (value == null) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  }
}

// Helper function to retrieve the session token
async function getStorageItemAsync(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.error('[AuthContext] Local storage is unavailable:', e);
      return null;
    }
  } else {
    return SecureStore.getItemAsync(key);
  }
}

// Provider component that wraps the app and makes auth available
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const segments = useSegments();
  const router = useRouter();
  const [isRouterReady, setIsRouterReady] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Check if router is ready
  useEffect(() => {
    if (router && typeof router.replace === 'function') {
      setIsRouterReady(true);
    }
  }, [router]);

  // Setup Supabase auth listener for real-time state management
  useEffect(() => {
    console.log('[AuthContext] Setting up auth listener');
    
    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log(`[AuthContext] Auth state changed: ${event}`);
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (newSession) {
            console.log('[AuthContext] Got new session, saving token');
            await setStorageItemAsync(SESSION_KEY, newSession.access_token);
            setSession(newSession.access_token);
            
            // Also update the user object
            setUser(newSession.user || null);
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('[AuthContext] User signed out, clearing session');
          await setStorageItemAsync(SESSION_KEY, null);
          setSession(null);
          setUser(null);
        } else if (event === 'USER_UPDATED') {
          console.log('[AuthContext] User data updated, refreshing');
          if (newSession) {
            setUser(newSession.user || null);
          }
        }
      }
    );
    
    // Load initial session on mount
    const loadInitialSession = async () => {
      try {
        console.log('[AuthContext] Loading initial session');
        setIsLoading(true);
        
        // Use the ExpoAuthSession helper to get the current session
        const supabaseSession = await getCurrentSession();
        
        if (supabaseSession) {
          console.log('[AuthContext] Found active Supabase session');
          // Save token to storage and state
          await setStorageItemAsync(SESSION_KEY, supabaseSession.access_token);
          setSession(supabaseSession.access_token);
          setUser(supabaseSession.user || null);
        } else {
          // No active Supabase session, try to get from storage
          console.log('[AuthContext] No active Supabase session, checking storage');
          const storedToken = await getStorageItemAsync(SESSION_KEY);
          
          if (storedToken) {
            console.log('[AuthContext] Found token in storage, trying to restore session');
            // Try to restore the session
            const { data: { user: userData }, error: userError } = 
              await supabase.auth.getUser(storedToken);
            
            if (userError) {
              console.error('[AuthContext] Error restoring session:', userError);
              // Clear invalid token
              await setStorageItemAsync(SESSION_KEY, null);
              setSession(null);
              setUser(null);
            } else if (userData) {
              console.log('[AuthContext] Session restored successfully');
              setSession(storedToken);
              setUser(userData);
            } else {
              console.warn('[AuthContext] No user data with stored token');
              await setStorageItemAsync(SESSION_KEY, null);
              setSession(null);
              setUser(null);
            }
          } else {
            console.log('[AuthContext] No stored token found');
            setSession(null);
            setUser(null);
          }
        }
      } catch (error) {
        console.error('[AuthContext] Failed to load initial session:', error);
        // Reset state on error
        await setStorageItemAsync(SESSION_KEY, null);
        setSession(null);
        setUser(null);
      } finally {
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    };
    
    loadInitialSession();
    
    // Cleanup subscription on unmount
    return () => {
      console.log('[AuthContext] Cleaning up auth listener');
      subscription?.unsubscribe();
    };
  }, []);

  // Handle routing based on authentication state
  useEffect(() => {
    // Only run navigation logic once loading is complete and router is ready
    // Also skip if segments aren't stable yet (e.g., during initial transition)
    if (isLoading || !isRouterReady || !segments || !Array.isArray(segments) || segments.length === 0) {
      console.log('[AuthContext] Navigation effect skipped (loading, router not ready, or segments unstable)');
      return;
    }

    const currentSegment = segments[0];
    const inAuthGroup = currentSegment === 'auth';
    // Ensure welcome/onboarding check is robust
    const inWelcomeFlow = currentSegment === 'welcome' || currentSegment === 'onboarding'; 

    console.log('[AuthContext] Running navigation check:', { 
      session: !!session, 
      inAuthGroup,
      inWelcomeFlow,
      currentSegment,
      segments
    });

    try {
      // User is logged in, but on an auth page (login/register) -> Redirect to home
      if (session && inAuthGroup) {
        console.log('[AuthContext] User signed in, but on auth page. Redirecting to /');
        // Wrap in setTimeout to defer navigation slightly
        setTimeout(() => router.replace('/'), 0);
      } 
      // User is logged out, AND not on an auth page, AND not in the welcome/onboarding flow -> Redirect to welcome
      else if (!session && !inAuthGroup && !inWelcomeFlow) {
        console.log('[AuthContext] User not signed in and not on auth/welcome/onboarding. Redirecting to /welcome');
        // Wrap in setTimeout to defer navigation slightly
        setTimeout(() => router.replace('/welcome'), 0);
      } 
      // All other cases: User is logged in and on a non-auth page,
      // OR User is logged out and on auth/welcome/onboarding page. -> Do nothing.
      else {
         console.log('[AuthContext] No navigation needed.');
      }
    } catch (error) {
      console.error('[AuthContext] Navigation error:', error);
      // Avoid potential loops caused by errors during navigation attempts
    }
    // Depend only on the core state affecting navigation: session and segments.
    // isLoading and isRouterReady act as guards within the effect.
  }, [session, segments, isLoading, isRouterReady]); // Keep guards in deps to re-run when they become ready

  // Update the authentication methods
  const signIn = async (email: string, password: string) => {
    try {
      console.log('[AuthContext] Signing in with email and password');
      const result = await signInWithEmail(email, password);
      
      if (result.success && result.session) {
        console.log('[AuthContext] Sign in successful');
        await setStorageItemAsync(SESSION_KEY, result.session.access_token);
        setSession(result.session.access_token);
        setUser(result.user || null);
        return { success: true };
      }
      
      return { 
        success: false, 
        error: result.error || new Error('Sign in failed') 
      };
    } catch (error) {
      console.error('[AuthContext] Failed to sign in:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Unknown error during sign in') 
      };
    }
  };

  const signUp = async (email: string, password: string, metadata?: any) => {
    try {
      console.log('[AuthContext] Creating new account');
      const result = await signUpWithEmail(email, password, { metadata });
      
      if (result.success) {
        // If session is returned immediately (email confirmation not required)
        if (result.session) {
          await setStorageItemAsync(SESSION_KEY, result.session.access_token);
          setSession(result.session.access_token);
          setUser(result.user || null);
        }
        
        return { 
          success: true, 
          confirmationRequired: result.confirmationRequired
        };
      }
      
      return { 
        success: false, 
        error: result.error || new Error('Sign up failed')
      };
    } catch (error) {
      console.error('[AuthContext] Failed to sign up:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Unknown error during sign up')
      };
    }
  };

  const signOut = async () => {
    try {
      console.log('[AuthContext] Signing out');
      // Use the ExpoAuthSession signOut function
      const result = await expoSignOut();
      
      if (!result.success) {
        console.error('[AuthContext] Supabase sign out error:', result.error);
      }
      
      // Always clear our local session state, even if Supabase sign out fails
      await setStorageItemAsync(SESSION_KEY, null);
      setSession(null);
      setUser(null);
    } catch (error) {
      console.error('[AuthContext] Failed to sign out:', error);
      // Still clear local state even if there's an error
      await setStorageItemAsync(SESSION_KEY, null);
      setSession(null);
      setUser(null);
    }
  };

  // Add a refresh token function
  const refreshToken = async () => {
    try {
      console.log('[AuthContext] Refreshing authentication token');
      const result = await refreshSession();
      
      if (result.success && result.session) {
        console.log('[AuthContext] Token refresh successful');
        await setStorageItemAsync(SESSION_KEY, result.session.access_token);
        setSession(result.session.access_token);
        setUser(result.user || null);
        return true;
      }
      
      console.error('[AuthContext] Token refresh failed:', result.error);
      return false;
    } catch (error) {
      console.error('[AuthContext] Error during token refresh:', error);
      return false;
    }
  };

  // Provide the authentication context to children
  return (
    <AuthContext.Provider value={{ 
      signIn, 
      signUp,
      signOut, 
      refreshToken,
      session, 
      isLoading, 
      user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
} 