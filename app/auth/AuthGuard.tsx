import React, { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import LoadingIndicator from '../../components/LoadingIndicator';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  console.log('[AuthGuard] Component rendering started');
  const router = useRouter();
  console.log('[AuthGuard] Router initialized');
  
  // Safely use the auth hook with a try-catch block
  try {
    console.log('[AuthGuard] About to call useAuth hook');
    const { session, loading } = useAuth();
    console.log('[AuthGuard] useAuth hook called successfully', { hasSession: !!session, loading });

    useEffect(() => {
      console.log('[AuthGuard] useEffect running', { hasSession: !!session, loading });
      if (!loading && !session) {
        console.log('[AuthGuard] No session detected, redirecting to login');
        router.replace('/auth/login');
      }
    }, [session, loading, router]);

    if (loading) {
      console.log('[AuthGuard] Still loading, showing loading indicator');
      return (
        <LoadingIndicator 
          message="Loading..." 
          containerStyle={styles.container}
        />
      );
    }

    if (!session) {
      console.log('[AuthGuard] No session, returning null (will redirect in useEffect)');
      return null; // Will redirect in the useEffect
    }

    console.log('[AuthGuard] Session found, rendering children');
    return <>{children}</>;
  } catch (error) {
    console.error('[AuthGuard] Error using useAuth in AuthGuard:', error);
    console.error('[AuthGuard] Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
    console.error('[AuthGuard] Component tree location:', new Error().stack);
    
    // Return an error UI if useAuth fails
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Authentication Error</Text>
        <Text style={styles.errorText}>
          There was a problem with the authentication system. Please restart the app.
        </Text>
        <Text style={styles.errorDetails}>
          Error: {error instanceof Error ? error.message : 'Unknown error'}
        </Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F2F2F7',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorDetails: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
});
