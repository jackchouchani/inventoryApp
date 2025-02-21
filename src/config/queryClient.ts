import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { handleNetworkError } from '../utils/errorHandler';
import { supabase } from './supabase';
import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

const isNetworkError = (error: any) => {
  return (
    error?.message?.includes('Failed to fetch') ||
    error?.message?.includes('Network request failed') ||
    error?.message?.includes('net::ERR') ||
    error?.name === 'NetworkError'
  );
};

const isAuthError = (error: any) => {
  return error?.status === 401 || 
         error?.message?.includes('JWT') || 
         error?.message?.includes('token') ||
         error?.message?.includes('auth');
};

const checkAuthStatus = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
};

const handleAuthError = async (error: Error) => {
  if (!navigator.onLine && Platform.OS === 'web') {
    return false;
  }

  Sentry.captureException(error, {
    tags: { type: 'auth_error' }
  });

  try {
    const isAuthenticated = await checkAuthStatus();
    if (!isAuthenticated) {
      return false;
    }

    const { error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError) {
      return true;
    }
  } catch (refreshError) {
    Sentry.captureException(refreshError, {
      tags: { type: 'auth_refresh_error' }
    });
  }
  return false;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      enabled: false, // Désactive toutes les requêtes par défaut
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: (failureCount, error) => {
        if (isAuthError(error)) {
          return failureCount < 1;
        }
        if (isNetworkError(error)) {
          return failureCount < 5;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => {
        const baseDelay = 1000;
        const maxDelay = 30000;
        return Math.min(baseDelay * (2 ** attemptIndex), maxDelay);
      },
      networkMode: Platform.OS === 'web' ? 'online' : 'always',
    },
    mutations: {
      retry: (failureCount, error) => {
        if (isAuthError(error)) {
          return failureCount < 1;
        }
        if (isNetworkError(error)) {
          return failureCount < 3;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => {
        const baseDelay = 1000;
        const maxDelay = 15000;
        return Math.min(baseDelay * (2 ** attemptIndex), maxDelay);
      },
      networkMode: Platform.OS === 'web' ? 'online' : 'always',
    },
  },
  queryCache: new QueryCache({
    onError: async (error, query) => {
      if (error instanceof Error) {
        if (isNetworkError(error)) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const isAuthenticated = await checkAuthStatus();
          if (isAuthenticated) {
            query.fetch();
          }
          return;
        }

        if (isAuthError(error)) {
          const refreshSuccess = await handleAuthError(error);
          if (refreshSuccess) {
            query.fetch();
            return;
          }
        }
        handleNetworkError(error);
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: async (error, variables, _context, mutation) => {
      if (error instanceof Error) {
        if (isNetworkError(error)) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const isAuthenticated = await checkAuthStatus();
          if (isAuthenticated) {
            mutation.execute(variables);
          }
          return;
        }

        if (isAuthError(error)) {
          const refreshSuccess = await handleAuthError(error);
          if (refreshSuccess) {
            mutation.execute(variables);
            return;
          }
        }
        handleNetworkError(error);
      }
    },
  }),
}); 