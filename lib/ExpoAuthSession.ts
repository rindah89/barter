import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Make sure to close the authentication session when it completes
WebBrowser.maybeCompleteAuthSession();

// Determine the redirect URL based on the environment
// For Android, we need to ensure the redirect URI is correctly formatted
const scheme = Constants.manifest?.scheme || 'barter';
const redirectUri = Platform.OS === 'android' 
  ? `${scheme}://auth-callback` 
  : `${scheme}://auth-callback`;

console.log('[ExpoAuthSession] Redirect URI:', redirectUri);

/**
 * Gets the current session using Supabase
 * This centralizes the session retrieval logic
 */
export async function getCurrentSession() {
  try {
    console.log('[ExpoAuthSession] Retrieving current session');
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('[ExpoAuthSession] Error getting current session:', error);
      return null;
    }
    
    if (data.session) {
      console.log('[ExpoAuthSession] Valid session found');
      return data.session;
    }
    
    console.log('[ExpoAuthSession] No active session found');
    return null;
  } catch (error) {
    console.error('[ExpoAuthSession] Unexpected error getting session:', error);
    return null;
  }
}

/**
 * Signs in with email and password using Supabase
 * @param email User's email
 * @param password User's password
 */
export async function signInWithEmail(email: string, password: string) {
  try {
    console.log('[ExpoAuthSession] Signing in with email');
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('[ExpoAuthSession] Email sign-in error:', error);
      return { success: false, error };
    }
    
    if (data.session) {
      console.log('[ExpoAuthSession] Email sign-in successful');
      return { success: true, session: data.session, user: data.user };
    }
    
    return { success: false, error: new Error('No session returned') };
  } catch (error) {
    console.error('[ExpoAuthSession] Unexpected error during email sign-in:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error('Unknown error during sign-in') 
    };
  }
}

/**
 * Refreshes the current session
 */
export async function refreshSession() {
  try {
    console.log('[ExpoAuthSession] Refreshing session');
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('[ExpoAuthSession] Error refreshing session:', error);
      return { success: false, error };
    }
    
    if (data.session) {
      console.log('[ExpoAuthSession] Session refreshed successfully');
      return { success: true, session: data.session, user: data.user };
    }
    
    return { success: false, error: new Error('No session returned after refresh') };
  } catch (error) {
    console.error('[ExpoAuthSession] Unexpected error refreshing session:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error('Unknown error during session refresh') 
    };
  }
}

/**
 * Registers a new user with email, password and optional user metadata
 */
export async function signUpWithEmail(
  email: string, 
  password: string,
  options?: { 
    metadata?: { [key: string]: any },
    redirectTo?: string
  }
) {
  try {
    console.log('[ExpoAuthSession] Creating new account with email');
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: options?.metadata,
        emailRedirectTo: options?.redirectTo || redirectUri
      }
    });
    
    if (error) {
      console.error('[ExpoAuthSession] Email sign-up error:', error);
      return { success: false, error };
    }
    
    return { 
      success: true, 
      session: data.session, 
      user: data.user,
      confirmationRequired: !data.session
    };
  } catch (error) {
    console.error('[ExpoAuthSession] Unexpected error during sign-up:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error('Unknown error during sign-up') 
    };
  }
}

/**
 * Signs out the current user
 */
export async function signOut() {
  try {
    console.log('[ExpoAuthSession] Signing out');
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('[ExpoAuthSession] Error during sign-out:', error);
      return { success: false, error };
    }
    
    return { success: true };
  } catch (error) {
    console.error('[ExpoAuthSession] Unexpected error during sign-out:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error('Unknown error during sign-out') 
    };
  }
}

/**
 * Gets the Deep Link URL that will redirect back to the app
 * This is useful for setting up redirect URLs in email templates
 */
export function getDeepLinkRedirectUri() {
  return redirectUri;
} 