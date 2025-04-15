// supabase.ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { ExpoSecureStoreAdapter } from './ExpoSecureStoreAdapter';
import { Tables } from '../database.types';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define types using the database schema
export type Profile = Tables<'profiles'>;
export type Item = Tables<'items'>;
export type Trade = Tables<'trades'>;
export type Message = Tables<'messages'>;
export type UserInterest = Tables<'user_interests'>;
export type Review = Tables<'reviews'>;
export type LikedItem = Tables<'liked_items'>;

// Hardcoded fallback values (only use in development)
const FALLBACK_SUPABASE_URL = 'https://gwskbuserenviqctthqt.supabase.co';
const FALLBACK_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3c2tidXNlcmVudmlxY3R0aHF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2ODY1MzYsImV4cCI6MjA1NjI2MjUzNn0.TdrV123kRCGb7sLoc5iSaLvxJy6f-w0n8ejuWBjFL7o';

// Get Supabase URL and anon key from environment variables with fallbacks
const supabaseUrl = 
  process.env.EXPO_PUBLIC_SUPABASE_URL || 
  Constants.expoConfig?.extra?.SUPABASE_URL || 
  FALLBACK_SUPABASE_URL;

const supabaseAnonKey = 
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
  Constants.expoConfig?.extra?.SUPABASE_ANON_KEY || 
  FALLBACK_SUPABASE_KEY;

// Validate Supabase configuration
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase configuration. Make sure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env file.'
  );
}

// Display Supabase configuration (without showing the full key for security)
console.log(`Using Supabase URL: ${supabaseUrl}`);
console.log(`Using Supabase anon key: ${supabaseAnonKey ? '***' + supabaseAnonKey.substring(supabaseAnonKey.length - 6) : 'Not set'}`);

// Determine the appropriate storage mechanism based on platform
// On Android, SecureStore can sometimes cause issues, so we use AsyncStorage as fallback
const storageAdapter = Platform.OS === 'android' 
  ? {
      getItem: async (key: string): Promise<string | null> => {
        try {
          // Try SecureStore first
          const secureValue = await ExpoSecureStoreAdapter.getItem(key);
          if (secureValue !== null) return secureValue;
          
          // Fall back to AsyncStorage if SecureStore fails or returns null
          return await AsyncStorage.getItem(key);
        } catch (error) {
          console.warn('SecureStore error, falling back to AsyncStorage:', error);
          return AsyncStorage.getItem(key);
        }
      },
      setItem: async (key: string, value: string): Promise<void> => {
        try {
          // Try to store in both for redundancy
          await ExpoSecureStoreAdapter.setItem(key, value);
          await AsyncStorage.setItem(key, value);
        } catch (error) {
          console.warn('SecureStore error, using only AsyncStorage:', error);
          await AsyncStorage.setItem(key, value);
        }
      },
      removeItem: async (key: string): Promise<void> => {
        try {
          // Remove from both storage mechanisms
          await ExpoSecureStoreAdapter.removeItem(key);
          await AsyncStorage.removeItem(key);
        } catch (error) {
          console.warn('SecureStore error during removal, using only AsyncStorage:', error);
          await AsyncStorage.removeItem(key);
        }
      },
    }
  : ExpoSecureStoreAdapter;

// Create Supabase client using the appropriate storage adapter
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: storageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    debug: __DEV__, // Enable debug logging in development
    flowType: 'pkce', // Use PKCE flow which works better on mobile
  },
});

/* // Temporarily remove or comment out the debug wrapper to fix type errors
if (__DEV__) {
  const originalFrom = supabase.from;
  const originalAuth = supabase.auth;

  // Override the 'from' method to add error logging
  supabase.from = function(...args) {
    const result = originalFrom.apply(this, args);

    // Add error logging to common mutation methods
    const methodsToWrap = ['insert', 'update', 'upsert', 'delete'] as const;

    methodsToWrap.forEach(methodName => {
      const originalMethod = result[methodName];
      if (typeof originalMethod === 'function') {
        (result as any)[methodName] = function(...methodArgs: any[]) {
          // Call the original method (insert, update, etc.) using the builder's context (`this`)
          const builder = originalMethod.apply(this, methodArgs); // Use `this` here

          // Wrap the 'then' method of the returned builder to catch errors upon execution
          const originalThen = builder.then;

          // Define the wrapped then
          // Using Function type assertion for simplicity due to complex generic interactions
          builder.then = function(
            onfulfilled?: ((value: any) => any) | null | undefined,
            onrejected?: ((reason: any) => any) | null | undefined
          ): PromiseLike<any> {
            // Call the original 'then' using the builder as the context
            return originalThen.call(
              builder, // Correct context for .then
              onfulfilled, // Pass fulfillment handler through
              (err: any) => {
                // Log the error
                console.error(`Supabase error in .from('${args[0]}').${methodName}():`, err);
                // Call the original rejection handler or re-throw
                if (onrejected) {
                  // Directly call and return the result of the original handler
                  return onrejected(err);
                }
                // Re-throw the original error if no handler provided
                // Use Promise.reject to ensure it propagates correctly in the promise chain
                return Promise.reject(err);
              }
            );
          };

          // No .catch to wrap

          return builder; // Return the builder with wrapped .then
        };
      }
    });

    // Add similar wrapping for RPC calls if needed

    return result;
  };

  // Override auth methods to add error logging
  const authMethodsToWrap: (keyof typeof supabase.auth)[] = ['signUp', 'signInWithPassword', 'signOut', 'resetPasswordForEmail', 'updateUser']; // Add others as needed

  authMethodsToWrap.forEach(methodName => {
      const originalAuthMethod = supabase.auth[methodName];
      if (typeof originalAuthMethod === 'function') {
        (supabase.auth as any)[methodName] = async function(...authArgs: any[]) {
            try {
                // Use the correct context (`supabase.auth`)
                return await originalAuthMethod.apply(supabase.auth, authArgs);
            } catch (err) {
                console.error(`Supabase Auth ${methodName} error:`, err);
                throw err;
            }
        };
      }
  });

}
*/
