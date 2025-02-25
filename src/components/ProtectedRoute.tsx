import React, { useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DataLoader } from './DataLoader';
import { useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { isEqual, debounce } from 'lodash';
import { ErrorBoundary } from './ErrorBoundary';
import { Category } from '../types/category';
import { Container } from '../types/container';
import * as Sentry from '@sentry/react-native';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

type QueryData = {
  categories: Category[];
  containers: Container[];
};

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const previousDataRef = useRef<QueryData>({
    categories: [],
    containers: []
  });
  const isSyncingRef = useRef(false);

  // Mémoisation des données du cache
  const memoizedCategories = useMemo(() => 
    queryClient.getQueryData<Category[]>(['categories']) ?? [],
    [queryClient]
  );

  const memoizedContainers = useMemo(() => 
    queryClient.getQueryData<Container[]>(['containers']) ?? [],
    [queryClient]
  );

  const syncDataWithRedux = useCallback(() => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      const shouldUpdateCategories = !isEqual(memoizedCategories, previousDataRef.current.categories);
      const shouldUpdateContainers = !isEqual(memoizedContainers, previousDataRef.current.containers);

      if (shouldUpdateCategories) {
        previousDataRef.current.categories = [...memoizedCategories];
        dispatch({ type: 'categories/setCategories', payload: memoizedCategories });
      }
      
      if (shouldUpdateContainers) {
        previousDataRef.current.containers = [...memoizedContainers];
        dispatch({ type: 'containers/setContainers', payload: memoizedContainers });
      }
    } catch (error) {
      console.error('Error syncing data with Redux:', error);
      Sentry.captureException(error, {
        extra: {
          component: 'ProtectedRoute',
          action: 'syncDataWithRedux',
          categoriesCount: memoizedCategories.length,
          containersCount: memoizedContainers.length
        }
      });
    } finally {
      isSyncingRef.current = false;
    }
  }, [queryClient, dispatch, memoizedCategories, memoizedContainers]);

  // Debounce de la fonction de synchronisation
  const debouncedSync = useMemo(() => 
    debounce(syncDataWithRedux, 300),
    [syncDataWithRedux]
  );

  React.useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      if (!isSyncingRef.current) {
        requestAnimationFrame(debouncedSync);
      }
    });

    return () => {
      unsubscribe();
      isSyncingRef.current = false;
      debouncedSync.cancel(); // Nettoyage du debounce
    };
  }, [queryClient, debouncedSync]);

  if (isLoading) {
    return fallback ?? null;
  }

  if (!user) {
    return null;
  }

  return (
    <ErrorBoundary>
      <DataLoader>{children}</DataLoader>
    </ErrorBoundary>
  );
} 