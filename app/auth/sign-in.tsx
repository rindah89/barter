import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Redirect, useRouter } from 'expo-router';

/**
 * This is a redirect screen that follows the Expo Router authentication pattern.
 * It redirects to the login screen or welcome screen as appropriate.
 * 
 * Having this file at /auth/sign-in.tsx is important for the Expo Router authentication
 * pattern to work correctly, as it's the default path that the router will navigate to
 * when a user is not authenticated.
 */
export default function SignInScreen() {
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();

  // Add a small delay to ensure router is fully initialized
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Use programmatic navigation as a fallback if Redirect component fails
  useEffect(() => {
    if (isReady) {
      try {
        // First try to check if user is coming from a direct auth request
        const shouldGoToLoginDirectly = window.location?.search?.includes('direct=true');
        
        if (shouldGoToLoginDirectly) {
          router.replace('/auth/login');
        } else {
          // Otherwise send to welcome screen for better user experience
          router.replace('/welcome');
        }
      } catch (error) {
        console.error('[SignInScreen] Error during navigation:', error);
        // Default to login if there's an error
        router.replace('/auth/login');
      }
    }
  }, [isReady, router]);

  // Show loading indicator while preparing to redirect
  if (!isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#22C55E" />
        <Text style={styles.text}>Redirecting...</Text>
      </View>
    );
  }

  // Use the Redirect component as the primary method (will go to welcome by default)
  try {
    // Check if direct=true is in the URL params
    const shouldGoToLoginDirectly = window.location?.search?.includes('direct=true');
    
    // Redirect accordingly
    if (shouldGoToLoginDirectly) {
      return <Redirect href="/auth/login" />;
    } else {
      return <Redirect href="/welcome" />;
    }
  } catch (error) {
    console.error('[SignInScreen] Redirect component error:', error);
    // Fallback to a loading screen if Redirect fails
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#22C55E" />
        <Text style={styles.text}>Redirecting to welcome...</Text>
      </View>
    );
  }
}

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