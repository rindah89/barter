import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../lib/AuthContext';

type ProtectedRouteProps = {
  children: React.ReactNode;
  fallbackRoute?: string;
};

export default function ProtectedRoute({
  children,
  fallbackRoute = '/auth/login',
}: ProtectedRouteProps) {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && !session) {
      router.replace(fallbackRoute);
    }
  }, [session, loading, fallbackRoute]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  if (!session) {
    return null; // Will redirect in the useEffect
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
}); 