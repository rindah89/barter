import { useEffect, useState } from 'react';
import { Stack, ErrorBoundary as ExpoRouterErrorBoundary } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../lib/AuthContext';
import { ToastProvider } from '../lib/ToastContext';
import { LoadingProvider } from '../lib/LoadingContext';
import LoadingOverlay from '../components/LoadingOverlay';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { 
  StandardErrorView, 
  ErrorBoundaryFallback, 
  logError, 
  SafeErrorView 
} from '../lib/ErrorUtils.tsx';

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
      logError(e, 'ErrorBoundary');
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
            </Stack>
            <LoadingOverlay />
            <StatusBar style="auto" />
          </LoadingProvider>
        </ToastProvider>
      </AuthProvider>
    </ExpoRouterErrorBoundary>
  );
}