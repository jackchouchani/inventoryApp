import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// URL de l'API Supabase
const supabaseUrl = 'https://lixpixyyszvcuwpcgmxe.supabase.co';

// Clé API anonyme (publique)
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpeHBpeHl5c3p2Y3V3cGNnbXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODA2NTY4ODQsImV4cCI6MTk5NjIzMjg4NH0.n-wlnGAojzgt2mGTy2wFsS9JWXQwDTjXGHH0TkpGOpI';

// Création du client Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Vérifie si l'utilisateur est authentifié
 * @returns Promise avec l'état d'authentification
 */
export const isAuthenticated = async (): Promise<boolean> => {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
};

/**
 * Récupère l'ID de l'utilisateur actuel
 * @returns L'ID de l'utilisateur ou null s'il n'est pas connecté
 */
export const getCurrentUserId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id || null;
}; 