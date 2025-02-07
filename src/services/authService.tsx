import { supabase } from '../config/supabase';
import { Platform } from 'react-native';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export const authService = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  async signUp(email: string, password: string, name: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user ? {
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.name
    } : null;
  },

  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  async initializeAnonymousSession() {
    if (Platform.OS === 'web') {
      return supabase.auth.signInWithPassword({
        email: process.env.EXPO_PUBLIC_ANONYMOUS_EMAIL || 'anonymous@example.com',
        password: process.env.EXPO_PUBLIC_ANONYMOUS_PASSWORD || 'anonymous'
      });
    }
    return null;
  }
};
