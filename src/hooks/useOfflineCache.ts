import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';
import debounce from 'lodash/debounce';
import * as Sentry from '@sentry/react-native';
import { Category } from '../types/category';
import { Container } from '../types/container';
import { errorHandler } from '../utils/errorHandler';
import { checkNetworkConnection } from '../utils/networkUtils';
import { Platform } from 'react-native';

const CACHE_KEYS = {
  categories: 'secure_cache_categories_v1',
  containers: 'secure_cache_containers_v1',
} as const;

// Schémas de validation
const categorySchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  // ... autres champs de Category
}));

const containerSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  // ... autres champs de Container
}));

// Interface de stockage abstraite
const storage = {
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.warn('Erreur lors de la sauvegarde dans localStorage:', error);
      }
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key);
    }
  }
};

export const useOfflineCache = () => {
  const queryClient = useQueryClient();

  // Fonction de sauvegarde sécurisée
  const saveToSecureStore = useCallback(async (key: string, data: unknown) => {
    try {
      const isConnected = await checkNetworkConnection();
      if (!isConnected) {
        Sentry.addBreadcrumb({
          category: 'cache',
          message: 'Tentative de sauvegarde en mode hors ligne',
          level: 'info',
        });
      }

      await storage.setItem(key, JSON.stringify(data));
    } catch (error) {
      errorHandler.handleError(error, {
        context: 'useOfflineCache.saveToSecureStore',
        extraData: { key },
      });
    }
  }, []);

  // Sauvegarde du cache avec debounce
  const debouncedSaveCache = useCallback(
    debounce(async () => {
      try {
        const categories = queryClient.getQueryData<Category[]>(['categories']);
        const containers = queryClient.getQueryData<Container[]>(['containers']);

        if (categories) {
          categorySchema.parse(categories); // Validation
          await saveToSecureStore(CACHE_KEYS.categories, categories);
        }

        if (containers) {
          containerSchema.parse(containers); // Validation
          await saveToSecureStore(CACHE_KEYS.containers, containers);
        }
      } catch (error) {
        errorHandler.handleError(error, {
          context: 'useOfflineCache.saveCache',
          severity: 'warning',
        });
      }
    }, 1000),
    [queryClient, saveToSecureStore]
  );

  // Écoute des mutations du cache
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      debouncedSaveCache();
    });

    return () => {
      unsubscribe();
      debouncedSaveCache.cancel();
    };
  }, [debouncedSaveCache, queryClient]);

  // Restauration du cache
  useEffect(() => {
    const restoreCache = async () => {
      try {
        const [categoriesCache, containersCache] = await Promise.all([
          storage.getItem(CACHE_KEYS.categories),
          storage.getItem(CACHE_KEYS.containers),
        ]);

        if (categoriesCache) {
          const parsedCategories = JSON.parse(categoriesCache);
          categorySchema.parse(parsedCategories); // Validation
          queryClient.setQueryData(['categories'], parsedCategories);
        }

        if (containersCache) {
          const parsedContainers = JSON.parse(containersCache);
          containerSchema.parse(parsedContainers); // Validation
          queryClient.setQueryData(['containers'], parsedContainers);
        }
      } catch (error) {
        errorHandler.handleError(error, {
          context: 'useOfflineCache.restoreCache',
          severity: 'error',
        });
      }
    };

    restoreCache();
  }, [queryClient]);
}; 