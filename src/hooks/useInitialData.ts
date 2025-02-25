import { useQuery, UseQueryResult, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import { Category } from '../types/category';
import { Container } from '../types/container';
import { useNetworkStatus } from './useNetworkStatus';
import * as Sentry from '@sentry/react-native';
import { useAuth } from '../contexts/AuthContext';
import { useSegments } from 'expo-router';
import React from 'react';

interface UseInitialDataResult {
  categories: UseQueryResult<Category[]>;
  containers: UseQueryResult<Container[]>;
  isLoading: boolean;
  error: Error | null;
}

const STALE_TIME = 1000 * 60 * 5; // 5 minutes
const RETRY_COUNT = 3;

export const useInitialData = (): UseInitialDataResult => {
  const { isConnected } = useNetworkStatus();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const segments = useSegments();
  const isAuthGroup = segments[0] === "(auth)";
  const shouldFetch = !!user && !isAuthGroup && isConnected;

  const fetchCategories = async (): Promise<Category[]> => {
    try {
      if (!shouldFetch) {
        return [];
      }

      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .is('deleted', false);

      if (error) {
        Sentry.captureException(error, {
          tags: {
            location: 'useInitialData',
            operation: 'fetchCategories'
          }
        });
        throw error;
      }

      return data || [];
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  };

  const fetchContainers = async (): Promise<Container[]> => {
    try {
      if (!shouldFetch) {
        return [];
      }

      const { data, error } = await supabase
        .from('containers')
        .select('*')
        .is('deleted', false);

      if (error) {
        Sentry.captureException(error, {
          tags: {
            location: 'useInitialData',
            operation: 'fetchContainers'
          }
        });
        throw error;
      }

      return data || [];
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  };

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: STALE_TIME,
    gcTime: 1000 * 60 * 60 * 24, // 24 heures
    retry: RETRY_COUNT,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: shouldFetch
  });

  const containers = useQuery({
    queryKey: ['containers'],
    queryFn: fetchContainers,
    staleTime: STALE_TIME,
    gcTime: 1000 * 60 * 60 * 24,
    retry: RETRY_COUNT,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: shouldFetch
  });

  // Configuration des subscriptions Supabase pour les mises à jour en temps réel
  React.useEffect(() => {
    if (!shouldFetch) return;

    const categoriesSubscription = supabase
      .channel('categories_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'categories' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['categories'] });
        }
      )
      .subscribe();

    const containersSubscription = supabase
      .channel('containers_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'containers' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['containers'] });
        }
      )
      .subscribe();

    return () => {
      categoriesSubscription.unsubscribe();
      containersSubscription.unsubscribe();
    };
  }, [shouldFetch, queryClient]);

  return {
    categories,
    containers,
    isLoading: shouldFetch && (categories.isLoading || containers.isLoading),
    error: categories.error || containers.error
  };
}; 