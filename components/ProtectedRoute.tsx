import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import LoadingIndicator from './LoadingIndicator';

type ProtectedRouteProps = {
  children: React.ReactNode;
  fallbackRoute?: string;
};

export default function ProtectedRoute({
  children,
  fallbackRoute = '/auth/login',
}: ProtectedRouteProps) {
  console.log('[ProtectedRoute] Component rendering started');
  
  try {
    console.log('[ProtectedRoute] About to call useAuth hook');
    const { session, loading } = useAuth();
    console.log('[ProtectedRoute] useAuth hook called successfully', { hasSession: !!session, loading });

    useEffect(() => {
      console.log('[ProtectedRoute] useEffect running', { hasSession: !!session, loading });
      if (!loading && !session) {
        console.log('[ProtectedRoute] No session detected, redirecting to', fallbackRoute);
        router.replace(fallbackRoute);
      }
    }, [session, loading, fallbackRoute]);

    if (loading) {
      console.log('[ProtectedRoute] Still loading, showing loading indicator');
      return (
        <LoadingIndicator 
          message="Loading..." 
          containerStyle={styles.loadingContainer}
        />
      );
    }

    if (!session) {
      console.log('[ProtectedRoute] No session, returning null (will redirect in useEffect)');
      return null; // Will redirect in the useEffect
    }

    console.log('[ProtectedRoute] Session found, rendering children');
    return <>{children}</>;
  } catch (error) {
    console.error('[ProtectedRoute] Error using useAuth:', error);
    console.error('[ProtectedRoute] Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
    console.error('[ProtectedRoute] Component tree location:', new Error().stack);
    
    // Return null and let the app handle the error state
    return null;
  }
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
}); 