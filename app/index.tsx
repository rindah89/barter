import React, { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { fixErrorHandling } from '../lib/ErrorFix';
import { applyExpoRouterFix } from '../lib/ExpoRouterFix';
import { useAuth } from '../lib/AuthContext';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

// Apply error handling fixes immediately
if (typeof global !== 'undefined') {
  // Apply our error handling fixes
  fixErrorHandling();
  
  // Apply Expo Router specific fixes
  applyExpoRouterFix();
  
  // Monkey patch Error.prototype.toString to ensure it never fails
  const originalToString = Error.prototype.toString;
  Error.prototype.toString = function() {
    try {
      return originalToString.call(this);
    } catch (e) {
      return 'Error: [Error conversion failed]';
    }
  };
  
  // Ensure all errors have a message property
  const originalErrorConstructor = global.Error;
  global.Error = function(...args) {
    const error = new originalErrorConstructor(...args);
    if (!error.message) {
      try {
        error.message = args[0] || 'Unknown error';
      } catch (e) {
        // Cannot set message, ignore
      }
    }
    return error;
  };
  global.Error.prototype = originalErrorConstructor.prototype;
  
  console.log('[App] Applied error handling fixes');
}

export default function Index() {
  const { isLoading, user } = useAuth();
  
  useEffect(() => {
    console.log('[Index] Rendering index page, auth status:', { isLoading, isAuthenticated: !!user });
  }, [isLoading, user]);
  
  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#22C55E" />
        <Text style={styles.text}>Loading...</Text>
      </View>
    );
  }
  
  // Redirect based on authentication status
  if (user) {
    // User is authenticated, go to main app
    return <Redirect href="/splash" />;
  } else {
    // User is not authenticated, go to welcome screen
    return <Redirect href="/welcome" />;
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