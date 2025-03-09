import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import SplashScreen from './components/SplashScreen';

export default function SplashPage() {
  // Add a fallback navigation in case the component-level navigation fails
  useEffect(() => {
    console.log('[SplashPage] Component mounted');
    
    // Fallback timeout - navigate after 10 seconds no matter what
    const fallbackTimeout = setTimeout(() => {
      console.log('[SplashPage] Fallback timeout triggered');
      try {
        console.log('[SplashPage] Attempting fallback navigation to (tabs)');
        router.replace('/(tabs)');
      } catch (error) {
        console.error('[SplashPage] Fallback navigation error:', error);
        // Try welcome as a last resort
        try {
          router.replace('/welcome');
        } catch (lastError) {
          console.error('[SplashPage] Last resort navigation error:', lastError);
        }
      }
    }, 10000);
    
    return () => {
      clearTimeout(fallbackTimeout);
      console.log('[SplashPage] Component unmounted');
    };
  }, []);

  return (
    <View style={styles.container}>
      <SplashScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
}); 