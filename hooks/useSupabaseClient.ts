import { useState, useEffect } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/database.types'; // Adjust path if necessary
import * as SecureStore from 'expo-secure-store';

// Define a custom storage adapter for Expo SecureStore
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    SecureStore.deleteItemAsync(key);
  },
};

// Central place for Supabase URL and Anon Key
// Ensure these environment variables are set up correctly in your project (e.g., via .env file and expo config)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Type for the Supabase client specific to your Database schema
type TypedSupabaseClient = SupabaseClient<Database>;

let supabase: TypedSupabaseClient | null = null;

/**
 * Hook to get the Supabase client instance.
 * Initializes the client if it hasn't been already.
 * Uses Expo SecureStore for session persistence.
 */
export const useSupabaseClient = (): TypedSupabaseClient | null => {
  const [client, setClient] = useState<TypedSupabaseClient | null>(supabase);

  useEffect(() => {
    if (!client) {
      if (!supabaseUrl) {
        console.error('Supabase URL is not defined. Check your environment variables.');
        return;
      }
      if (!supabaseAnonKey) {
        console.error('Supabase Anon Key is not defined. Check your environment variables.');
        return;
      }

      // Create the client only once
      if (!supabase) {
          console.log('Initializing Supabase client...');
          supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
            auth: {
              storage: ExpoSecureStoreAdapter,
              autoRefreshToken: true,
              persistSession: true,
              detectSessionInUrl: false, // Important for React Native
            },
          });
      }
      setClient(supabase);
    }
  }, [client]); // Run only when client state changes (initially null)

  return client;
};

// Optional: Export the singleton instance directly if needed elsewhere non-reactively
// export const supabaseInstance = supabase; 