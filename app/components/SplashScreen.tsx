import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Animated, Text, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';

interface SplashScreenProps {
  onFinish?: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;
  const [loadingText, setLoadingText] = useState('Loading...');
  const [animationComplete, setAnimationComplete] = useState(false);

  // Add a safety timeout to prevent infinite splash screen
  useEffect(() => {
    console.log('[SplashScreen] Component mounted');
    
    // Safety timeout - force navigation after 8 seconds if animation doesn't complete
    const safetyTimeout = setTimeout(() => {
      console.log('[SplashScreen] Safety timeout triggered');
      if (!animationComplete) {
        console.log('[SplashScreen] Animation did not complete in time, forcing navigation');
        handleNavigationComplete();
      }
    }, 8000);
    
    return () => {
      clearTimeout(safetyTimeout);
      console.log('[SplashScreen] Component unmounted');
    };
  }, [animationComplete]);

  const handleNavigationComplete = () => {
    setAnimationComplete(true);
    if (onFinish) {
      console.log('[SplashScreen] Calling onFinish callback');
      onFinish();
    } else {
      // Default behavior: navigate to the main screen
      try {
        console.log('[SplashScreen] Attempting to navigate to (tabs)');
        router.replace('/(tabs)');
      } catch (error) {
        console.error('[SplashScreen] Navigation error:', error);
        // Show error to user in development
        if (__DEV__) {
          Alert.alert('Navigation Error', String(error));
        }
        // Fallback navigation
        console.log('[SplashScreen] Attempting fallback navigation to index');
        try {
          router.replace('/');
        } catch (fallbackError) {
          console.error('[SplashScreen] Fallback navigation error:', fallbackError);
          // Last resort - try welcome screen
          try {
            router.replace('/welcome');
          } catch (lastError) {
            console.error('[SplashScreen] Last resort navigation error:', lastError);
          }
        }
      }
    }
  };

  useEffect(() => {
    console.log('[SplashScreen] Starting animation sequence');
    setLoadingText('Initializing...');
    
    // Animation sequence
    Animated.sequence([
      // Fade in and scale up
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      // Wait for a moment
      Animated.delay(2000),
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      // Animation complete callback
      console.log('[SplashScreen] Animation sequence finished:', finished);
      if (finished) {
        handleNavigationComplete();
      }
    });

    // Update loading text periodically to show progress
    const loadingInterval = setInterval(() => {
      setLoadingText((current) => {
        if (current === 'Loading...') return 'Preparing...';
        if (current === 'Preparing...') return 'Almost ready...';
        return 'Loading...';
      });
    }, 1000);

    return () => clearInterval(loadingInterval);
  }, [fadeAnim, scaleAnim, onFinish]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={require('../../assets/logoipsum-225.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22C55E" />
          <Text style={styles.loadingText}>{loadingText}</Text>
        </View>
      </Animated.View>
      
      {/* App name with animated fade-in */}
      <Animated.Text style={[styles.appName, { opacity: fadeAnim }]}>
        Barter
      </Animated.Text>
      
      {/* Tagline with animated fade-in */}
      <Animated.Text style={[styles.tagline, { opacity: fadeAnim }]}>
        Trade Goods, Not Money
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    width: 240,
    height: 240,
    marginBottom: 20,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666666',
  },
  appName: {
    marginTop: 20,
    fontSize: 32,
    fontWeight: 'bold',
    color: '#22C55E',
  },
  tagline: {
    marginTop: 10,
    fontSize: 18,
    color: '#666666',
  },
});

export default SplashScreen; 