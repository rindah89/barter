import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { router } from 'expo-router';
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
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize the auth state on component mount
  useEffect(() => {
    // Get the current session
    const initializeAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
        setUser(data.session?.user ?? null);
      } catch (error) {
        console.error('Error loading auth session:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
      }
    );

    // Clean up the subscription when unmounting
    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
      await supabase.auth.signOut();
      router.replace('/auth/login');
    } catch (error) {
      console.error('Sign out error:', error);
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
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

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
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
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