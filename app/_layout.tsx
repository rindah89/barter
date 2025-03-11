import { useEffect, useState } from 'react';
import { Stack, ErrorBoundary as ExpoRouterErrorBoundary } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../lib/AuthContext';
import { ToastProvider } from '../lib/ToastContext';
import { LoadingProvider } from '../lib/LoadingContext';
import LoadingOverlay from '../components/LoadingOverlay';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';

declare global {
  interface Window {
    frameworkReady?: () => void;
  }
}

// Custom error boundary component
export function ErrorBoundary({ children, error }: { children: React.ReactNode, error?: Error }) {
  const [hasError, setHasError] = useState(!!error);
  const [errorState, setErrorState] = useState<Error | null>(error || null);

  useEffect(() => {
    // Add global error handler using React Native's ErrorUtils
    const errorHandler = (e: Error) => {
      console.error('[ErrorBoundary] Caught global error:', e);
      setErrorState(e);
      setHasError(true);
    };

    // Set up the error handler
    if (global.ErrorUtils) {
      global.ErrorUtils.setGlobalHandler(errorHandler);
    }

    return () => {
      // Reset to default handler on cleanup
      if (global.ErrorUtils) {
        global.ErrorUtils.setGlobalHandler((error: Error) => {
          console.error(error);
        });
      }
    };
  }, []);

  if (hasError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorMessage}>
          {errorState?.message || 'An unknown error occurred'}
        </Text>
        <Text style={styles.errorHint}>Try restarting the app</Text>
      </View>
    );
  }

  return children;
}

// Custom error view for Expo Router
export function ErrorComponent({ error }: { error: Error | null }) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Navigation Error</Text>
      <Text style={styles.errorMessage}>
        {error?.message || 'An unknown navigation error occurred'}
      </Text>
      <Text style={styles.errorHint}>Please try again or restart the app</Text>
    </View>
  );
}

// Make ErrorBoundary available to expo-router
export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'index',
  // Used for error handling in expo-router
  ErrorBoundary: ErrorBoundary,
};

export default function RootLayout() {
  console.log('[RootLayout] Rendering root layout');
  
  useEffect(() => {
    console.log('[RootLayout] Root layout useEffect running');
    
    // Log device info
    console.log('[RootLayout] Platform:', Platform.OS);
    console.log('[RootLayout] App version:', Constants.expoConfig?.version);
    
    // Check if Supabase config is available
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    console.log('[RootLayout] Supabase URL available:', !!supabaseUrl);
    console.log('[RootLayout] Supabase key available:', !!supabaseKey);
    
    // Add unhandled promise rejection handler using ErrorUtils
    if (global.ErrorUtils) {
      const rejectionHandler = (error: Error) => {
        console.error('[RootLayout] Unhandled promise rejection:', error);
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
  }, []);

  console.log('[RootLayout] Setting up providers and navigation stack');
  return (
    <ExpoRouterErrorBoundary fallback={props => <ErrorComponent error={props.error} />}>
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
            </Stack>
            <LoadingOverlay />
            <StatusBar style="auto" />
          </LoadingProvider>
        </ToastProvider>
      </AuthProvider>
    </ExpoRouterErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f8f8',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#e74c3c',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  errorHint: {
    fontSize: 14,
    color: '#7f8c8d',
  },
});