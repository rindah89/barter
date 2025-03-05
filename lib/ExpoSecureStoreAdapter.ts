import * as SecureStore from 'expo-secure-store';

/**
 * Custom storage adapter for Supabase Auth using Expo's SecureStore
 * This ensures that tokens are stored securely on the device
 */
export const ExpoSecureStoreAdapter = {
  getItem: (key: string): Promise<string | null> => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string): Promise<void> => {
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string): Promise<void> => {
    return SecureStore.deleteItemAsync(key);
  },
};
