import { useCategoriesOptimized as useCategories } from './useCategoriesOptimized';
import { useContainersOptimized as useContainers } from './useContainersOptimized';
import { useLocationsOptimized as useLocations } from './useLocationsOptimized';
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
  locations: {
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

  const { 
    data: locations, 
    isLoading: locationsLoading, 
    error: locationsError 
  } = useLocations();

  const isLoading = shouldFetch && (categoriesLoading || containersLoading || locationsLoading);
  const error = categoriesError || containersError || locationsError;

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
    locations: {
      data: locations || [],
      isLoading: locationsLoading,
      error: locationsError
    },
    isLoading,
    error
  };
}; 