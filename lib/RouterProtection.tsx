/**
 * RouterProtection.tsx
 * This file contains components and hooks to protect against common Expo Router issues
 * Based on insights from https://github.com/expo/router/issues/349
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRootNavigationState, useSegments, useRouter } from 'expo-router';

/**
 * A wrapper component that ensures router is initialized before rendering children
 * This addresses the issue where router hooks are used before initialization
 */
export function RouterInitializedProvider({ 
  children,
  fallback = <DefaultLoadingFallback />
}: { 
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [isRouterReady, setIsRouterReady] = useState(false);
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    // Only consider the router ready when we have a valid navigation state
    if (rootNavigationState !== undefined && rootNavigationState !== null) {
      console.log('[RouterProtection] Router initialized with valid navigation state');
      setIsRouterReady(true);
    }
  }, [rootNavigationState]);

  // Always render children in development to avoid hiding issues
  if (__DEV__) {
    return <>{children}</>;
  }

  // In production, wait for router to be ready
  if (!isRouterReady) {
    return fallback;
  }

  return <>{children}</>;
}

/**
 * A wrapper for authentication providers that ensures children are always rendered
 * This addresses the issue mentioned by boris-burgos where providers didn't return children
 */
export function SafeAuthProvider({ 
  children, 
  isLoading = false,
  isSignedIn = false,
  onInitialize = () => {},
  fallback = <DefaultLoadingFallback />
}: { 
  children: React.ReactNode;
  isLoading?: boolean;
  isSignedIn?: boolean;
  onInitialize?: () => void;
  fallback?: React.ReactNode;
}) {
  const segments = useSegments();
  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState(false);

  // Handle authentication state changes
  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);
      onInitialize();
      return;
    }

    // Skip when still loading
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';
    
    // If the user is signed in and we're on an auth page, redirect away
    if (isSignedIn && inAuthGroup) {
      router.replace('/');
      return;
    }
    
    // If the user is not signed in and we're not on an auth page, redirect to auth
    if (!isSignedIn && !inAuthGroup) {
      router.replace('/auth');
      return;
    }
  }, [isSignedIn, isLoading, segments, isInitialized]);

  // Always render children, even during loading or redirects
  // This ensures the router state is properly maintained
  return <>{isLoading ? fallback : children}</>;
}

/**
 * A hook that safely accesses router segments
 * This addresses the issue where segments could be undefined
 */
export function useSafeSegments() {
  const segments = useSegments();
  
  // Return a safe value if segments is undefined
  if (!segments) {
    console.warn('[RouterProtection] Segments accessed before initialization');
    return [];
  }
  
  return segments;
}

/**
 * A default loading component to show while router initializes
 */
function DefaultLoadingFallback() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0000ff" />
      <Text style={styles.text}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  text: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
}); 