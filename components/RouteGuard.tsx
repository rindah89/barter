import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

interface RouteGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * RouteGuard component that can be used to protect routes requiring authentication.
 * It checks if the user is authenticated and redirects to the specified route if not.
 * 
 * @param children The components to render if authenticated
 * @param redirectTo Where to redirect if not authenticated, defaults to '/welcome'
 */
const RouteGuard: React.FC<RouteGuardProps> = ({ 
  children, 
  redirectTo = '/welcome' 
}) => {
  const { isLoading, user } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (!isLoading && !user) {
      console.log('[RouteGuard] User not authenticated, redirecting to', redirectTo);
      router.replace(redirectTo);
    }
  }, [isLoading, user, router, redirectTo]);
  
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#22C55E" />
        <Text style={styles.text}>Checking authentication...</Text>
      </View>
    );
  }
  
  if (!user) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#22C55E" />
        <Text style={styles.text}>Redirecting...</Text>
      </View>
    );
  }
  
  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  text: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
});

export default RouteGuard; 