import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../lib/AuthContext';
import { ToastProvider } from '../lib/ToastContext';
import { LoadingProvider } from '../lib/LoadingContext';
import LoadingOverlay from '../components/LoadingOverlay';

declare global {
  interface Window {
    frameworkReady?: () => void;
  }
}

export default function RootLayout() {
  console.log('[RootLayout] Rendering root layout');
  
  useEffect(() => {
    console.log('[RootLayout] Root layout useEffect running');
    window.frameworkReady?.();
  }, []);

  console.log('[RootLayout] Setting up providers and navigation stack');
  return (
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
            <Stack.Screen name="debug" />
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
  );
}