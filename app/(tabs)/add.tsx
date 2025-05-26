import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { useRouter } from 'expo-router';
import { database } from '../../src/database/database';
import { setItems } from '../../src/store/itemsActions';
import ItemForm from '../../src/components/ItemForm';
import { useRefreshStore } from '../../src/store/refreshStore';
import { Container } from '../../src/types/container';
import { Category } from '../../src/types/category';
import { Item } from '../../src/types/item';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import * as Sentry from '@sentry/react-native';
import { handleNetworkError } from '../../src/utils/errorHandler';
import { useAppTheme } from '../../src/contexts/ThemeContext';

const QUERY_KEYS = {
  containers: 'containers',
  categories: 'categories',
  items: 'items'
} as const;

const CACHE_CONFIG = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 30 * 60 * 1000, // 30 minutes
  retry: 3,
  networkMode: Platform.OS === 'web' ? 'online' : 'always',
} as const;

type QueryError = Error;

const AddScreenContent: React.FC = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const refreshTimestamp = useRefreshStore(state => state.refreshTimestamp);
  const { activeTheme } = useAppTheme();

  const { data: containers = [], isLoading: containersLoading, error: containersError } = useQuery<Container[], QueryError>({
    queryKey: [QUERY_KEYS.containers, refreshTimestamp],
    queryFn: async () => {
      try {
        const data = await database.getContainers();
        return data || [];
      } catch (error) {
        if (error instanceof Error) {
          Sentry.captureException(error, {
            tags: { type: 'containers_fetch_error' }
          });
          throw error;
        }
        throw new Error('Erreur lors de la récupération des conteneurs');
      }
    },
    ...CACHE_CONFIG
  });

  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = useQuery<Category[], QueryError>({
    queryKey: [QUERY_KEYS.categories, refreshTimestamp],
    queryFn: async () => {
      try {
        const data = await database.getCategories();
        return data || [];
      } catch (error) {
        if (error instanceof Error) {
          Sentry.captureException(error, {
            tags: { type: 'categories_fetch_error' }
          });
          throw error;
        }
        throw new Error('Erreur lors de la récupération des catégories');
      }
    },
    ...CACHE_CONFIG
  });

  const { data: items = [], isLoading: itemsLoading, error: itemsError } = useQuery<Item[], QueryError>({
    queryKey: [QUERY_KEYS.items, refreshTimestamp],
    queryFn: async () => {
      try {
        const data = await database.getItems();
        return data || [];
      } catch (error) {
        if (error instanceof Error) {
          Sentry.captureException(error, {
            tags: { type: 'items_fetch_error' }
          });
          throw error;
        }
        throw new Error('Erreur lors de la récupération des items');
      }
    },
    ...CACHE_CONFIG
  });

  // Effet pour mettre à jour le store Redux quand les items changent
  useEffect(() => {
    if (items) {
      dispatch(setItems(items));
    }
  }, [items, dispatch]);

  const isLoading = containersLoading || categoriesLoading || itemsLoading;
  const error = containersError || categoriesError || itemsError;

  const handleSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.items] });
    router.push('/(tabs)/stock');
  }, [queryClient, router]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: activeTheme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={activeTheme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    handleNetworkError(error);
    throw error;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: activeTheme.background }]}>
      <View style={styles.content}>
        <ItemForm 
          containers={containers} 
          categories={categories}
          onSuccess={handleSuccess}
        />
      </View>
    </SafeAreaView>
  );
};

export default function AddScreen() {
  const handleReset = useCallback(() => {
    const queryClient = useQueryClient();
    queryClient.invalidateQueries();
  }, []);

  return (
    <ErrorBoundary
      onReset={handleReset}
    >
      <AddScreenContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor sera défini par le thème
    paddingBottom: Platform.OS === 'ios' ? 0 : 0,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    // color sera défini par le thème
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    // backgroundColor sera défini par le thème
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    // color sera défini par le thème
    fontSize: 16,
    fontWeight: '600',
  },
});
