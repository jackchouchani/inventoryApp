import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { handleNetworkError } from '../utils/errorHandler';

const queryCache = new QueryCache({
  onError: (error) => {
    if (error instanceof Error) {
      handleNetworkError(error, 'ReactQuery');
    }
  },
});

const mutationCache = new MutationCache({
  onError: (error) => {
    if (error instanceof Error) {
      handleNetworkError(error, 'ReactQuery.mutation');
    }
  },
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 24 * 60 * 60 * 1000, // 24 hours
      retry: 3, // 3 tentatives
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 3,
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
  queryCache,
  mutationCache,
}); 