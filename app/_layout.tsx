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
import { RouterInitializedProvider } from '../lib/RouterProtection';
import { SafeErrorBoundary } from '../lib/ExpoRouterFix';
import { patchExpoRouter } from '../lib/ExpoRouterPatch';

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

// Try to patch the StandardErrorView in expo-router for debugging
try {
  console.log('[_layout] Applying expo-router patch');
  patchExpoRouter();
} catch (e) {
  console.error('[_layout] Failed to apply patch:', e);
}

// Custom error boundary component
export function ErrorBoundary({ children, error }: { children: React.ReactNode, error?: Error }) {
  const [hasError, setHasError] = useState(!!error);
  const [errorState, setErrorState] = useState<Error | null>(error || null);

  useEffect(() => {
    // Add global error handler using React Native's ErrorUtils
    const errorHandler = (e: any) => {
      console.log('[ErrorBoundary] Caught error:', e);
      
      // Ensure we have a valid error object
      let errorObj;
      try {
        if (e === undefined || e === null) {
          errorObj = new Error('An undefined or null error was thrown');
        } else if (e instanceof Error) {
          // If it's already an Error object, use it directly
          errorObj = e;
        } else if (typeof e === 'string') {
          // If it's a string, create an Error with that message
          errorObj = new Error(e);
        } else if (typeof e === 'object') {
          // If it's another type of object, try to extract info
          if (e.message) {
            errorObj = new Error(e.message);
            if (e.stack) errorObj.stack = e.stack;
          } else {
            // If no message, stringify the object
            try {
              errorObj = new Error(JSON.stringify(e));
            } catch (jsonError) {
              errorObj = new Error('An error object that could not be stringified');
            }
          }
        } else {
          // Default case
          errorObj = new Error(`An unknown error occurred (type: ${typeof e})`);
        }

        // Ensure message is defined
        if (!errorObj.message) {
          Object.defineProperty(errorObj, 'message', {
            value: 'No error message provided',
            enumerable: true,
          });
        }
      } catch (errorHandlingError) {
        // If anything goes wrong processing the error, create a fallback
        console.error('[ErrorBoundary] Error while processing error:', errorHandlingError);
        errorObj = new Error('Failed to process error object');
      }
      
      // Log the error with our enhanced logger
      logError(errorObj, 'ErrorBoundary');
      
      // Update state to show error view
      setErrorState(errorObj);
      setHasError(true);
    };

    // Set up the error handler if available
    try {
      // @ts-ignore - ErrorUtils is available in React Native but not in TypeScript types
      if (typeof global !== 'undefined' && global.ErrorUtils) {
        console.log('[ErrorBoundary] Setting up global error handler');
        // @ts-ignore - ErrorUtils is available in React Native but not in TypeScript types
        global.ErrorUtils.setGlobalHandler(errorHandler);
      }
    } catch (err) {
      console.warn('[ErrorBoundary] Failed to set up global error handler:', err);
    }

    return () => {
      // Reset to default handler on cleanup
      try {
        // @ts-ignore - ErrorUtils is available in React Native but not in TypeScript types
        if (typeof global !== 'undefined' && global.ErrorUtils) {
          // @ts-ignore - ErrorUtils is available in React Native but not in TypeScript types
          global.ErrorUtils.setGlobalHandler((error: Error) => {
            console.error('[Default Error Handler]', error);
          });
        }
      } catch (err) {
        // Ignore cleanup errors
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
    
    // Add unhandled promise rejection handler
    try {
      // @ts-ignore - ErrorUtils is available in React Native but not in TypeScript types
      if (typeof global !== 'undefined' && global.ErrorUtils) {
        const rejectionHandler = (error: any) => {
          logError(error || new Error('Unknown promise rejection'), 'UnhandledPromiseRejection');
        };
        
        // @ts-ignore - ErrorUtils is available in React Native but not in TypeScript types
        const originalHandler = global.ErrorUtils.getGlobalHandler();
        // @ts-ignore - ErrorUtils is available in React Native but not in TypeScript types
        global.ErrorUtils.setGlobalHandler((error: any) => {
          rejectionHandler(error);
          originalHandler(error);
        });
        
        return () => {
          // @ts-ignore - ErrorUtils is available in React Native but not in TypeScript types
          global.ErrorUtils.setGlobalHandler(originalHandler);
        };
      }
    } catch (err) {
      console.warn('[RootLayout] Failed to set up promise rejection handler:', err);
    }
    
    // Log any startup errors that might have occurred
    try {
      // @ts-ignore - __ERRORS__ is available in React Native but not in TypeScript types
      const startupErrors = global.__ERRORS__ || [];
      if (startupErrors.length > 0) {
        console.log('[RootLayout] Found startup errors:', startupErrors.length);
        startupErrors.forEach((error: any) => {
          logError(error || new Error('Unknown startup error'), 'StartupError');
        });
      }
    } catch (err) {
      console.warn('[RootLayout] Failed to process startup errors:', err);
    }
  }, []);

  console.log('[RootLayout] Setting up providers and navigation stack');
  
  // Return the root layout with better error handling
  return (
    <SafeErrorBoundary onError={(error: Error) => logError(error, 'Root Layout Error Boundary')}>
      <StatusBar style="auto" />
      <AuthProvider>
        <ToastProvider>
          <LoadingProvider>
            <RouterInitializedProvider>
              <Stack screenOptions={{
                headerShown: false,
                animation: 'fade',
              }}>
                {/* List all your app screens here */}
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="splash" options={{ headerShown: false }} />
                <Stack.Screen name="welcome" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="auth" options={{ headerShown: false }} />
                <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
                <Stack.Screen name="terms-of-service" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" options={{ headerShown: false }} />
                <Stack.Screen name="notification-preferences" options={{ headerShown: false }} />
                <Stack.Screen name="privacy-settings" options={{ headerShown: false }} />
                <Stack.Screen name="account-security" options={{ headerShown: false }} />
                <Stack.Screen name="help-support" options={{ headerShown: false }} />
                <Stack.Screen name="chat-selection" options={{ headerShown: false }} />
                <Stack.Screen name="chat" options={{ headerShown: false }} />
                <Stack.Screen name="item-details" options={{ headerShown: false }} />
                <Stack.Screen name="debug" options={{ headerTitle: 'Debug' }} />
              </Stack>
              <LoadingOverlay />
            </RouterInitializedProvider>
          </LoadingProvider>
        </ToastProvider>
      </AuthProvider>
    </SafeErrorBoundary>
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