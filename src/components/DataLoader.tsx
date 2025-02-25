import React, { useEffect, useState, memo } from 'react';
import { View, ActivityIndicator, Text, Platform } from 'react-native';
import { useInitialData } from '../hooks/useInitialData';
import { styles } from '../styles/dataLoader';
import { theme } from '../utils/theme';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEYS = {
  categories: 'cache_categories_v1',
  containers: 'cache_containers_v1',
};

const storage = {
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  },
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    } else {
      return await AsyncStorage.getItem(key);
    }
  }
};

const CacheManager: React.FC = () => {
  const { user } = useAuth();
  const segments = useSegments();
  const isAuthGroup = segments[0] === "(auth)";
  const queryClient = useQueryClient();
  const [isInitialized, setIsInitialized] = useState(false);

  // Restaurer les données du cache au démarrage
  useEffect(() => {
    const restoreCache = async () => {
      if (user && !isAuthGroup && !isInitialized) {
        try {
          const [categoriesCache, containersCache] = await Promise.all([
            storage.getItem(CACHE_KEYS.categories),
            storage.getItem(CACHE_KEYS.containers),
          ]);

          if (categoriesCache) {
            const categories = JSON.parse(categoriesCache);
            queryClient.setQueryData(['categories'], categories);
          }

          if (containersCache) {
            const containers = JSON.parse(containersCache);
            queryClient.setQueryData(['containers'], containers);
          }

          setIsInitialized(true);
        } catch (error) {
          console.error('Erreur lors de la restauration du cache:', error);
        }
      }
    };

    restoreCache();
  }, [user, isAuthGroup, queryClient, isInitialized]);

  // Sauvegarder les données dans le cache
  useEffect(() => {
    if (!user || isAuthGroup || !isInitialized) return;

    const setupCache = async () => {
      try {
        const categories = queryClient.getQueryData(['categories']);
        const containers = queryClient.getQueryData(['containers']);

        if (categories) {
          await storage.setItem(CACHE_KEYS.categories, JSON.stringify(categories));
        }
        if (containers) {
          await storage.setItem(CACHE_KEYS.containers, JSON.stringify(containers));
        }
      } catch (error) {
        console.error('Erreur lors de la mise en cache:', error);
      }
    };

    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      setupCache();
    });

    return () => {
      unsubscribe();
    };
  }, [user, isAuthGroup, queryClient, isInitialized]);

  return null;
};

interface DataLoaderProps {
  children: React.ReactNode;
  onLoadComplete?: () => void;
  showLoadingUI?: boolean;
}

export const DataLoader: React.FC<DataLoaderProps> = memo(({ 
  children, 
  onLoadComplete,
  showLoadingUI = true 
}) => {
  const [hasCalledComplete, setHasCalledComplete] = useState(false);
  const { isLoading, error } = useInitialData();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const segments = useSegments();
  const isAuthGroup = segments[0] === "(auth)";

  useEffect(() => {
    queryClient.setDefaultOptions({
      queries: {
        ...queryClient.getDefaultOptions().queries,
        enabled: !!user && !isAuthGroup,
      },
    });

    if (user && !isAuthGroup) {
      queryClient.invalidateQueries();
    }
  }, [user, queryClient, isAuthGroup]);

  useEffect(() => {
    if (!hasCalledComplete && !isLoading) {
      setHasCalledComplete(true);
      onLoadComplete?.();
    }
  }, [isLoading, hasCalledComplete, onLoadComplete]);

  if (isAuthGroup) {
    return <>{children}</>;
  }

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          Une erreur est survenue lors du chargement des données
        </Text>
        <Text style={styles.errorDetail}>
          {error.message}
        </Text>
      </View>
    );
  }

  if (isLoading && showLoadingUI) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Chargement des données...</Text>
      </View>
    );
  }

  return (
    <>
      <CacheManager />
      {children}
    </>
  );
}); 