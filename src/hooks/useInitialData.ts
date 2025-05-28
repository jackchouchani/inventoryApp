import { useCategories } from './useCategories';
import { useContainers } from './useContainers';
import { useAuth } from '../contexts/AuthContext';
import { useSegments } from 'expo-router';

interface UseInitialDataResult {
  categories: {
    data: any[];
    isLoading: boolean;
    error: string | null;
  };
  containers: {
    data: any[];
    isLoading: boolean;
    error: string | null;
  };
  isLoading: boolean;
  error: Error | string | null;
}

export const useInitialData = (): UseInitialDataResult => {
  const { user } = useAuth();
  const segments = useSegments();
  const isAuthGroup = segments[0] === "(auth)";
  const shouldFetch = !!user && !isAuthGroup;

  // Utiliser les hooks Redux existants
  const { 
    categories, 
    isLoading: categoriesLoading, 
    error: categoriesError 
  } = useCategories();
  
  const { 
    data: containers, 
    isLoading: containersLoading, 
    error: containersError 
  } = useContainers();

  const isLoading = shouldFetch && (categoriesLoading || containersLoading);
  const error = categoriesError || containersError;

  return {
    categories: {
      data: categories || [],
      isLoading: categoriesLoading,
      error: categoriesError
    },
    containers: {
      data: containers || [],
      isLoading: containersLoading,
      error: containersError
    },
    isLoading,
    error
  };
}; 