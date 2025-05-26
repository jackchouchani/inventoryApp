import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { User, Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';

interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<{ user: User | null; session: Session | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initializeAnonymousSession = async () => {
    if (Platform.OS === 'web' && !session) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: process.env.EXPO_PUBLIC_ANONYMOUS_EMAIL || 'anonymous@example.com',
          password: process.env.EXPO_PUBLIC_ANONYMOUS_PASSWORD || 'anonymous'
        });
        
        if (error) throw error;
        setSession(data.session);
      } catch (error) {
        console.error('Erreur session anonyme:', error);
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    // Vérifier la session existante au démarrage
    async function initializeAuth() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (mounted) {
          setSession(session);
          if (session?.user) {
            setUser({
              id: session.user.id,
              email: session.user.email ?? '',
              name: session.user.user_metadata?.name
            });
          }
        }
      } catch (error) {
        console.error('Erreur d\'initialisation de l\'auth:', error);
        Sentry.captureException(error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (mounted) {
          setSession(session);
          if (session?.user) {
            setUser({
              id: session.user.id,
              email: session.user.email ?? '',
              name: session.user.user_metadata?.name
            });
          } else {
            setUser(null);
          }
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    user,
    session,
    isAuthenticated: !!user,
    isLoading,
    signIn: async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } finally {
        setIsLoading(false);
      }
    },
    signOut: async () => {
      setIsLoading(true);
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        // Nettoyer l'état après une déconnexion réussie
        setUser(null);
        setSession(null);
        return true; // Indiquer que la déconnexion a réussi
      } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
        throw error; // Propager l'erreur pour une gestion ultérieure
      } finally {
        setIsLoading(false);
      }
    },
    signUp: async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        return data;
      } finally {
        setIsLoading(false);
      }
    },
    initializeAnonymousSession
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
