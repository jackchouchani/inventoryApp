import { supabase } from '../config/supabase';
import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { AuthError } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

class AuthenticationError extends Error {
  constructor(message: string, public originalError?: AuthError) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

const handleAuthError = (error: AuthError): never => {
  let message: string;
  
  switch (error.message) {
    case 'Invalid login credentials':
      message = 'Email ou mot de passe incorrect';
      break;
    case 'Email not confirmed':
      message = 'Veuillez confirmer votre email avant de vous connecter';
      break;
    case 'Password recovery required':
      message = 'Une réinitialisation du mot de passe est nécessaire';
      break;
    case 'Rate limit exceeded':
      message = 'Trop de tentatives, veuillez réessayer plus tard';
      break;
    default:
      message = 'Une erreur est survenue lors de l\'authentification';
  }

  Sentry.captureException(error, {
    tags: {
      type: 'auth_error',
      error_code: error.status?.toString()
    },
    extra: {
      error_message: error.message,
      error_details: error.status
    }
  });

  throw new AuthenticationError(message, error);
};

const REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds

const shouldRefreshSession = (session: any) => {
  if (!session?.expires_at) return false;
  const expiresAt = new Date(session.expires_at).getTime();
  const now = Date.now();
  return expiresAt - now < REFRESH_THRESHOLD;
};

export const authService = {
  async signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        return handleAuthError(error);
      }
      
      return data;
    } catch (error) {
      if (error instanceof AuthError) {
        return handleAuthError(error);
      }
      throw error;
    }
  },

  async signUp(email: string, password: string, name: string) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name }
        }
      });
      
      if (error) {
        return handleAuthError(error);
      }
      
      return data;
    } catch (error) {
      if (error instanceof AuthError) {
        return handleAuthError(error);
      }
      throw error;
    }
  },

  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        return handleAuthError(error);
      }
    } catch (error) {
      if (error instanceof AuthError) {
        return handleAuthError(error);
      }
      throw error;
    }
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        return handleAuthError(error);
      }
      
      return user ? {
        id: user.id,
        email: user.email!,
        name: user.user_metadata?.name
      } : null;
    } catch (error) {
      if (error instanceof AuthError) {
        return handleAuthError(error);
      }
      throw error;
    }
  },

  async getSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        return handleAuthError(error);
      }

      if (session && shouldRefreshSession(session)) {
        const { data: { session: refreshedSession }, error: refreshError } = 
          await supabase.auth.refreshSession();
        
        if (refreshError) {
          Sentry.captureException(refreshError, {
            tags: { type: 'auth_refresh_error' }
          });
          // On continue avec la session existante même si le refresh échoue
          return session;
        }
        
        return refreshedSession;
      }
      
      return session;
    } catch (error) {
      if (error instanceof AuthError) {
        return handleAuthError(error);
      }
      throw error;
    }
  },

  async initializeAnonymousSession() {
    if (Platform.OS === 'web') {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: process.env.EXPO_PUBLIC_ANONYMOUS_EMAIL || 'anonymous@example.com',
          password: process.env.EXPO_PUBLIC_ANONYMOUS_PASSWORD || 'anonymous'
        });
        
        if (error) {
          return handleAuthError(error);
        }
        
        return data;
      } catch (error) {
        if (error instanceof AuthError) {
          return handleAuthError(error);
        }
        throw error;
      }
    }
    return null;
  },

  async setupAuthListener() {
    return supabase.auth.onAuthStateChange(async (event, _session) => {
      if (event === 'TOKEN_REFRESHED') {
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'Token refreshed successfully',
          level: 'info'
        });
      }
      
      if (event === 'SIGNED_OUT') {
        // Nettoyage du cache et des données locales si nécessaire
      }
    });
  }
};
