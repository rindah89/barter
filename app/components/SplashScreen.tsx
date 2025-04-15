import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Animated, Text, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import useAuthStatus from '../../hooks/useAuthStatus';

interface SplashScreenProps {
  onFinish?: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;
  const [loadingText, setLoadingText] = useState('Loading...');
  const [animationComplete, setAnimationComplete] = useState(false);
  const { status, refreshUserData } = useAuthStatus();
  const [authAttempts, setAuthAttempts] = useState(0);

  // Add a safety timeout to prevent infinite splash screen
  useEffect(() => {
    console.log('[SplashScreen] Component mounted, auth status:', status);
    
    // Safety timeout - force navigation after 12 seconds if everything doesn't complete
    const safetyTimeout = setTimeout(() => {
      console.log('[SplashScreen] Safety timeout triggered');
      if (!animationComplete) {
        console.log('[SplashScreen] Animation did not complete in time, forcing navigation');
        handleNavigationComplete();
      }
    }, 12000);
    
    return () => {
      clearTimeout(safetyTimeout);
      console.log('[SplashScreen] Component unmounted');
    };
  }, [animationComplete]);

  // Handler for when animation completes
  useEffect(() => {
    if (animationComplete) {
      console.log('[SplashScreen] Animation complete, waiting for auth status:', status);
      
      // Check if we need to do additional auth verification
      if (status === 'loading' || status === 'profile_loading') {
        console.log('[SplashScreen] Auth still loading, waiting...');
        // Update the loading text
        setLoadingText('Preparing your profile...');
        return;
      }
      
      // If auth failed or profile not loaded, try to refresh data
      if ((status === 'unauthenticated' || status === 'profile_error') && authAttempts < 2) {
        console.log('[SplashScreen] Auth issues, attempting refresh. Attempt:', authAttempts + 1);
        setAuthAttempts(prev => prev + 1);
        refreshUserData();
        // Update the loading text
        setLoadingText('Syncing your data...');
        return;
      }
      
      // Auth is ready or max attempts reached, proceed with navigation
      console.log('[SplashScreen] Auth status resolved:', status);
      handleNavigation();
    }
  }, [animationComplete, status, authAttempts]);

  const handleNavigationComplete = () => {
    setAnimationComplete(true);
  };
  
  const handleNavigation = () => {
    // Determine where to navigate based on auth status
    if (status === 'ready' || status === 'authenticated') {
      // User is fully authenticated with profile
      navigateTo('/(tabs)');
    } else if (status === 'unauthenticated') {
      // User is not authenticated
      navigateTo('/auth/sign-in');
    } else if (status === 'profile_error') {
      // User is authenticated but has profile issues
      navigateTo('/auth/create-profile');
    } else {
      // Fallback for any other status
      console.log('[SplashScreen] Uncertain auth status, defaulting to welcome screen');
      navigateTo('/welcome');
    }
  };
  
  const navigateTo = (route: string) => {
    try {
      console.log(`[SplashScreen] Navigating to ${route}`);
      if (onFinish) {
        onFinish();
      } else {
        router.replace(route);
      }
    } catch (error) {
      console.error('[SplashScreen] Navigation error:', error);
      // Show error to user in development
      if (__DEV__) {
        Alert.alert('Navigation Error', String(error));
      }
      // Fallback navigation to welcome screen
      try {
        router.replace('/welcome');
      } catch (fallbackError) {
        console.error('[SplashScreen] Fallback navigation error:', fallbackError);
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

    // Update loading text based on auth status
    const loadingInterval = setInterval(() => {
      setLoadingText((current) => {
        // Customize based on auth status
        if (status === 'loading') return 'Loading your account...';
        if (status === 'profile_loading') return 'Preparing your profile...';
        if (status === 'profile_error') return 'Repairing profile data...';
        
        // Default rotation
        if (current === 'Loading...') return 'Preparing...';
        if (current === 'Preparing...') return 'Almost ready...';
        return 'Loading...';
      });
    }, 1000);

    return () => clearInterval(loadingInterval);
  }, [fadeAnim, scaleAnim, onFinish, status]);

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
          {status === 'profile_loading' && (
            <Text style={styles.subText}>Syncing your profile...</Text>
          )}
          {status === 'profile_error' && authAttempts > 0 && (
            <Text style={styles.subText}>Attempting to fix profile data...</Text>
          )}
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
  subText: {
    marginTop: 5,
    fontSize: 14,
    color: '#999999',
    fontStyle: 'italic',
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