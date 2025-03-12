import { useEffect, useState } from 'react';
import { Stack, ErrorBoundary as ExpoRouterErrorBoundary } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../lib/AuthContext';
import { ToastProvider } from '../lib/ToastContext';
import { LoadingProvider } from '../lib/LoadingContext';
import LoadingOverlay from '../components/LoadingOverlay';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { 
  StandardErrorView, 
  ErrorBoundaryFallback, 
  logError, 
  SafeErrorView 
} from '../lib/ErrorUtils';
import { captureConsoleLogs } from '../lib/LogCapture';

declare global {
  interface Window {
    frameworkReady?: () => void;
  }
}

// Initialize log capture system
if (__DEV__) {
  captureConsoleLogs();
  console.log('[App] Console log capture initialized');
}

// Custom error boundary component
export function ErrorBoundary({ children, error }: { children: React.ReactNode, error?: Error }) {
  const [hasError, setHasError] = useState(!!error);
  const [errorState, setErrorState] = useState<Error | null>(error || null);

  useEffect(() => {
    // Add global error handler using React Native's ErrorUtils
    const errorHandler = (e: Error | any) => {
      console.log('[ErrorBoundary] Caught error:', e);
      
      // Ensure we have a valid error object
      const errorObj = e instanceof Error ? e : new Error(
        typeof e === 'string' ? e : 'An unknown error occurred'
      );
      
      // If the error doesn't have a message, add one
      if (!errorObj.message) {
        Object.defineProperty(errorObj, 'message', {
          value: 'No error message provided',
          enumerable: true,
        });
      }
      
      // Log the error with our enhanced logger
      logError(errorObj, 'ErrorBoundary');
      
      // Update state to show error view
      setErrorState(errorObj);
      setHasError(true);
    };

    // Set up the error handler
    if (global.ErrorUtils) {
      console.log('[ErrorBoundary] Setting up global error handler');
      global.ErrorUtils.setGlobalHandler(errorHandler);
    } else {
      console.warn('[ErrorBoundary] global.ErrorUtils is not available');
    }

    return () => {
      // Reset to default handler on cleanup
      if (global.ErrorUtils) {
        global.ErrorUtils.setGlobalHandler((error: Error) => {
          console.error('[Default Error Handler]', error);
        });
      }
    };
  }, []);

  if (hasError && errorState) {
    console.log('[ErrorBoundary] Rendering error view for:', errorState.message);
    return <SafeErrorView error={errorState} />;
  }

  return children;
}

// Make ErrorBoundary available to expo-router
export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'index',
  // Used for error handling in expo-router
  ErrorBoundary: ErrorBoundary,
};

// Debug button component that appears in development mode
function DebugButton() {
  const [showDebug, setShowDebug] = useState(false);
  const [pressCount, setPressCount] = useState(0);
  
  // Only show in development mode
  const isDev = process.env.NODE_ENV === 'development' || __DEV__;
  
  if (!isDev) return null;
  
  const handlePress = () => {
    setPressCount(prev => {
      const newCount = prev + 1;
      // Show debug after 5 presses
      if (newCount >= 5) {
        setShowDebug(true);
      }
      return newCount;
    });
  };
  
  if (!showDebug) {
    return (
      <TouchableOpacity 
        style={styles.hiddenDebugButton} 
        onPress={handlePress}
        activeOpacity={1}
      >
        <View />
      </TouchableOpacity>
    );
  }
  
  return (
    <TouchableOpacity 
      style={styles.debugButton} 
      onPress={() => {
        // Navigate to debug screen using the router
        try {
          const { router } = require('expo-router');
          router.push('/debug');
        } catch (error) {
          console.error('[DebugButton] Error navigating to debug screen:', error);
          // Fallback to window.location if router fails
          if (typeof window !== 'undefined' && window.location) {
            window.location.href = '/debug';
          }
        }
      }}
    >
      <Text style={styles.debugButtonText}>Debug</Text>
    </TouchableOpacity>
  );
}

export default function RootLayout() {
  console.log('[RootLayout] Rendering root layout');
  
  useEffect(() => {
    console.log('[RootLayout] Root layout useEffect running');
    
    // Log device info
    console.log('[RootLayout] Platform:', Platform.OS);
    console.log('[RootLayout] App version:', Constants.expoConfig?.version);
    console.log('[RootLayout] Development mode:', __DEV__ ? 'Yes' : 'No');
    
    // Check if Supabase config is available
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    console.log('[RootLayout] Supabase URL available:', !!supabaseUrl);
    console.log('[RootLayout] Supabase key available:', !!supabaseKey);
    
    // Add unhandled promise rejection handler using ErrorUtils
    if (global.ErrorUtils) {
      const rejectionHandler = (error: Error) => {
        logError(error, 'UnhandledPromiseRejection');
      };
      
      const originalHandler = global.ErrorUtils.getGlobalHandler();
      global.ErrorUtils.setGlobalHandler((error) => {
        rejectionHandler(error);
        originalHandler(error);
      });
      
      return () => {
        global.ErrorUtils.setGlobalHandler(originalHandler);
      };
    }
    
    // Log any startup errors that might have occurred
    const startupErrors = global.__ERRORS__ || [];
    if (startupErrors.length > 0) {
      console.log('[RootLayout] Found startup errors:', startupErrors.length);
      startupErrors.forEach((error: any) => {
        logError(error, 'StartupError');
      });
    }
  }, []);

  console.log('[RootLayout] Setting up providers and navigation stack');
  return (
    <ExpoRouterErrorBoundary fallback={props => <ErrorBoundaryFallback error={props.error} />}>
      <AuthProvider>
        <ToastProvider>
          <LoadingProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="splash" />
              <Stack.Screen name="welcome" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="auth" />
              <Stack.Screen name="privacy-policy" />
              <Stack.Screen name="terms-of-service" />
              <Stack.Screen name="+not-found" />
              <Stack.Screen name="notification-preferences" options={{ headerShown: false }} />
              <Stack.Screen name="privacy-settings" options={{ headerShown: false }} />
              <Stack.Screen name="account-security" options={{ headerShown: false }} />
              <Stack.Screen name="help-support" options={{ headerShown: false }} />
              <Stack.Screen name="chat-selection" options={{ headerShown: false }} />
              <Stack.Screen name="chat" options={{ headerShown: false }} />
              <Stack.Screen name="item-details" options={{ headerShown: false }} />
              <Stack.Screen name="debug" options={{ headerShown: true }} />
            </Stack>
            <LoadingOverlay />
            <StatusBar style="auto" />
            <DebugButton />
          </LoadingProvider>
        </ToastProvider>
      </AuthProvider>
    </ExpoRouterErrorBoundary>
  );
}

const styles = StyleSheet.create({
  debugButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(44, 62, 80, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  debugButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  hiddenDebugButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 50,
    height: 50,
    zIndex: 999,
  },
});