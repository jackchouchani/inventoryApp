import { createClient, AuthFlowType } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Les variables d\'environnement Supabase ne sont pas définies');
}

// Désactiver console.log en production
if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
}

const customStorage = {
  getItem: async (key: string) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.error('Erreur lors de la sauvegarde de la session:', e);
    }
  },
  removeItem: async (key: string) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.error('Erreur lors de la suppression de la session:', e);
    }
  }
};

// Configuration de base
const supabaseConfig = {
  auth: {
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
    storage: Platform.OS === 'web' ? localStorage : customStorage,
    autoRefreshToken: true,
    flowType: (Platform.OS === 'web' ? 'pkce' : 'implicit') as AuthFlowType,
    debug: false,
    logger: {
      error: () => {},
      warn: () => {},
      info: () => {}
    }
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  },
};

// Réduire la fréquence des rafraîchissements de token en développement
if (process.env.NODE_ENV === 'development') {
  supabaseConfig.auth.autoRefreshToken = false;
}

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  supabaseConfig
);
