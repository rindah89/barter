import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { router, useRootNavigationState } from 'expo-router';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, data?: object) => Promise<{ user: User | null; error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

// Create the auth context with a default undefined value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component that wraps the app and provides auth context
export function AuthProvider({ children }: { children: ReactNode }) {
  console.log('[AuthContext] AuthProvider rendering');
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const rootNavigationState = useRootNavigationState();

  // Initialize the auth state on component mount
  useEffect(() => {
    console.log('[AuthContext] AuthProvider useEffect running');
    
    // Get the current session
    const initializeAuth = async () => {
      console.log('[AuthContext] Initializing auth');
      try {
        const { data } = await supabase.auth.getSession();
        console.log('[AuthContext] Got session:', { hasSession: !!data.session });
        setSession(data.session);
        setUser(data.session?.user ?? null);
      } catch (error) {
        console.error('[AuthContext] Error loading auth session:', error);
      } finally {
        setLoading(false);
        console.log('[AuthContext] Auth initialization complete');
      }
    };

    initializeAuth();

    // Listen for auth state changes
    console.log('[AuthContext] Setting up auth state change listener');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        console.log('[AuthContext] Auth state changed:', { event: _event, hasSession: !!newSession });
        setSession(newSession);
        setUser(newSession?.user ?? null);
      }
    );

    // Clean up the subscription when unmounting
    return () => {
      console.log('[AuthContext] Cleaning up auth state change listener');
      subscription.unsubscribe();
    };
  }, []);

  // Effect to handle navigation after sign out
  useEffect(() => {
    if (isSigningOut && !session && rootNavigationState?.key != null) {
      // Router is ready and user is signed out, safe to navigate
      try {
        router.replace('/auth/login');
        setIsSigningOut(false);
      } catch (error) {
        console.error('Navigation error during sign out:', error);
        // If direct navigation fails, try a fallback
        try {
          router.replace('/splash');
        } catch (fallbackError) {
          console.error('Fallback navigation error:', fallbackError);
        } finally {
          setIsSigningOut(false);
        }
      }
    }
  }, [isSigningOut, session, rootNavigationState?.key]);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      return { error };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error: error as Error };
    }
  };

  // Sign up with email and password
  const signUp = async (email: string, password: string, data?: object) => {
    try {
      console.log('AuthContext: Starting signup process with email:', email);
      
      // Make the Supabase auth call
      const response = await supabase.auth.signUp({
        email,
        password,
        options: {
          data,
        },
      });
      
      const { data: authData, error } = response;
      
      // Log the response but not expose sensitive data
      console.log('AuthContext: Signup response:', {
        success: !!authData && !!authData.user,
        userId: authData?.user?.id,
        hasError: !!error,
        errorMessage: error?.message,
        statusCode: error?.status
      });

      // If there's an error, provide more details
      if (error) {
        console.error('AuthContext: Detailed signup error:', {
          message: error.message,
          status: error.status,
          name: error.name,
          code: error.code,
          details: error.details,
        });
      }

      return { user: authData?.user || null, error };
    } catch (error: any) {
      console.error('AuthContext: Signup catch block error:', {
        message: error.message,
        name: error.name,
        code: error.code || 'N/A',
        stack: error.stack ? 'Has stack trace' : 'No stack trace'
      });
      
      // Check if this is a network error
      if (error.message && (
        error.message.includes('NetworkError') ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('Network request failed')
      )) {
        return { 
          user: null, 
          error: new Error('Network error. Please check your internet connection and try again.') 
        };
      }
      
      return { user: null, error: error as Error };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setIsSigningOut(true);
      await supabase.auth.signOut();
      // Navigation will be handled by the effect above
    } catch (error) {
      console.error('Sign out error:', error);
      setIsSigningOut(false);
    }
  };

  // Reset password
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://yourapp.com/reset-password', // Replace with your actual reset password URL
      });
      
      return { error };
    } catch (error) {
      console.error('Reset password error:', error);
      return { error: error as Error };
    }
  };

  // Show a loading screen while the auth state is being fetched
  if (loading) {
    console.log('[AuthContext] Still loading, showing loading indicator');
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  console.log('[AuthContext] Rendering AuthProvider with context value', { hasSession: !!session, hasUser: !!user });
  // Provide the auth context value to children components
  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth() {
  console.log('[AuthContext] useAuth hook called');
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    console.error('[AuthContext] useAuth hook used outside of AuthProvider');
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  console.log('[AuthContext] useAuth hook returning context', { hasSession: !!context.session, hasUser: !!context.user });
  return context;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
}); 