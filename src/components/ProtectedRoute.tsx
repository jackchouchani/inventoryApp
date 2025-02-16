import React, { useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DataLoader } from './DataLoader';
import { useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { isEqual } from 'lodash';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

type QueryData = {
  categories: any[];
  containers: any[];
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const previousDataRef = useRef<QueryData>({
    categories: [],
    containers: []
  });
  const isSyncingRef = useRef(false);

  const syncDataWithRedux = useCallback(() => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      const categories = queryClient.getQueryData<any[]>(['categories']) || [];
      const containers = queryClient.getQueryData<any[]>(['containers']) || [];

      const shouldUpdateCategories = !isEqual(categories, previousDataRef.current.categories);
      const shouldUpdateContainers = !isEqual(containers, previousDataRef.current.containers);

      if (shouldUpdateCategories) {
        previousDataRef.current.categories = [...categories];
        dispatch({ type: 'categories/setCategories', payload: categories });
      }
      
      if (shouldUpdateContainers) {
        previousDataRef.current.containers = [...containers];
        dispatch({ type: 'containers/setContainers', payload: containers });
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, [queryClient, dispatch]);

  React.useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      if (!isSyncingRef.current) {
        requestAnimationFrame(syncDataWithRedux);
      }
    });

    return () => {
      unsubscribe();
      isSyncingRef.current = false;
    };
  }, [queryClient, syncDataWithRedux]);

  if (!user) {
    return null;
  }

  return <DataLoader>{children}</DataLoader>;
} 