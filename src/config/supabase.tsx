import { createClient, AuthFlowType } from '@supabase/supabase-js';

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

// Storage personnalisé qui gère le cas où localStorage n'est pas disponible
const webStorage = {
  getItem: async (key: string) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    } catch (e) {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.error('Erreur lors de la sauvegarde de la session:', e);
    }
  },
  removeItem: async (key: string) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.error('Erreur lors de la suppression de la session:', e);
    }
  }
};

// Configuration pour web app uniquement
const supabaseConfig = {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    storage: webStorage,
    autoRefreshToken: true,
    flowType: 'pkce' as AuthFlowType,
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
