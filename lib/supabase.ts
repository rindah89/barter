// supabase.ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { ExpoSecureStoreAdapter } from './ExpoSecureStoreAdapter';

// Get Supabase URL and anon key from environment variables
const supabaseUrl =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validate Supabase configuration
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase configuration. Make sure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env file.'
  );
}

// Display Supabase configuration (without showing the full key for security)
console.log(`Using Supabase URL: ${supabaseUrl}`);
console.log(`Using Supabase anon key: ${supabaseAnonKey ? '***' + supabaseAnonKey.substring(supabaseAnonKey.length - 6) : 'Not set'}`);

// Create Supabase client using the appropriate storage adapter
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    debug: __DEV__, // Enable debug logging in development
  },
});

// Add debug global error handler for Supabase operations
if (__DEV__) {
  const originalFrom = supabase.from;
  const originalAuth = supabase.auth;
  
  // Override the 'from' method to add error logging
  supabase.from = function(...args) {
    const result = originalFrom.apply(this, args);
    
    // Add error logging to common methods
    const originalInsert = result.insert;
    result.insert = async function(...insertArgs) {
      try {
        return await originalInsert.apply(this, insertArgs);
      } catch (err) {
        console.error(`Supabase error in .from('${args[0]}').insert():`, err);
        throw err;
      }
    };
    
    return result;
  };
  
  // Override auth methods to add error logging
  const originalSignUp = supabase.auth.signUp;
  supabase.auth.signUp = async function(...args) {
    try {
      return await originalSignUp.apply(this, args);
    } catch (err) {
      console.error('Supabase Auth signUp error:', err);
      throw err;
    }
  };
}

// Types for database tables
export type Profile = {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  rating: number;
  completed_trades: number;
  created_at: string;
  updated_at: string;
};

export type Item = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  media_type: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
};

export type Trade = {
  id: string;
  proposer_id: string;
  receiver_id: string;
  offered_item_id: string;
  requested_item_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  trade_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export type UserInterest = {
  id: string;
  user_id: string;
  interest: string;
  created_at: string;
};

export type Review = {
  id: string;
  trade_id: string;
  reviewer_id: string;
  reviewed_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type LikedItem = {
  id: string;
  user_id: string;
  item_id: string;
  created_at: string;
};
