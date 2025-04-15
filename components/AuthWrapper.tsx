import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import useAuthStatus from '../hooks/useAuthStatus';

// Important: Call this at the root of your component to close the authentication session
// when Auth Session completes
WebBrowser.maybeCompleteAuthSession();

interface AuthWrapperProps {
  children: React.ReactNode;
  authRequired?: boolean;
  fallback?: React.ReactNode;
  loadingComponent?: React.ReactNode;
}

/**
 * A wrapper component that handles authentication state and provides
 * consistent UI for authenticated vs unauthenticated states
 */
export const AuthWrapper: React.FC<AuthWrapperProps> = ({
  children,
  authRequired = true,
  fallback,
  loadingComponent,
}) => {
  const { status, user, profile } = useAuthStatus();
  const { session, refreshToken } = useAuth();
  const [isSessionValid, setIsSessionValid] = useState<boolean | null>(null);

  // Check if the current session is valid and refresh if needed
  useEffect(() => {
    const validateSession = async () => {
      try {
        if (!session) {
          console.log('[AuthWrapper] No session to validate');
          setIsSessionValid(false);
          return;
        }

        // Check if session is valid with Supabase
        console.log('[AuthWrapper] Validating session with Supabase');
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[AuthWrapper] Session validation error:', error);
          setIsSessionValid(false);
          return;
        }
        
        if (data.session) {
          console.log('[AuthWrapper] Session is valid');
          setIsSessionValid(true);
        } else {
          console.log('[AuthWrapper] Session is invalid, attempting to refresh');
          // Try to refresh the token
          const refreshed = await refreshToken();
          setIsSessionValid(refreshed);
          
          if (refreshed) {
            console.log('[AuthWrapper] Token refreshed successfully');
          } else {
            console.warn('[AuthWrapper] Failed to refresh token');
          }
        }
      } catch (err) {
        console.error('[AuthWrapper] Error validating session:', err);
        setIsSessionValid(false);
      }
    };
    
    validateSession();
  }, [session, refreshToken]);
  
  // Determine what to render based on auth state and requirements
  const renderContent = () => {
    // Still loading auth status or validating session
    if (
      status === 'loading' || 
      status === 'profile_loading' || 
      isSessionValid === null
    ) {
      return loadingComponent || (
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#22C55E" />
          <Text style={styles.loadingText}>Verifying authentication...</Text>
        </View>
      );
    }
    
    // Auth is required but user is not authenticated or session is invalid
    if (
      authRequired && 
      (status === 'unauthenticated' || 
       status === 'profile_error' || 
       isSessionValid === false)
    ) {
      return fallback || (
        <View style={styles.container}>
          <Text style={styles.messageText}>Authentication required</Text>
        </View>
      );
    }
    
    // User is authenticated with a valid session, or auth is not required
    return children;
  };
  
  return renderContent();
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  messageText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
  },
});

export default AuthWrapper; 