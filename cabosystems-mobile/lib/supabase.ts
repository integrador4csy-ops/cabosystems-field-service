import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { networkFetch } from './networkFetch';

const WebStorageAdapter = {
  getItem: async (key: string) => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem(key);
    }
    return null;
  },
  setItem: async (key: string, value: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
  },
  removeItem: async (key: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
  },
};

const NativeStorageAdapter = (() => {
  const SecureStore = require('expo-secure-store');
  return {
    getItem: (key: string) => SecureStore.getItemAsync(key),
    setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
    removeItem: (key: string) => SecureStore.deleteItemAsync(key),
  };
})();

const storageAdapter = Platform.OS === 'web' ? WebStorageAdapter : NativeStorageAdapter;

const DEFAULT_SUPABASE_URL = 'https://nyqlfgnblkmijxspkvpi.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55cWxmZ25ibGttaWp4c3BrdnBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNTQ4OTEsImV4cCI6MjEwNDczMDg5MX0.KRv2R3wIafx6zHGYB4mhSD4p7OzN8mfWc_mq89JueR4';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: networkFetch },
  auth: {
    storage: storageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
