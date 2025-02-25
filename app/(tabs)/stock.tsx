import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Text, Platform, ActivityIndicator } from 'react-native';
import ItemList from '../../src/components/ItemList';
import { FilterBar } from '../../src/components/FilterBar';
import { useDispatch } from 'react-redux';
import { useInventoryData } from '../../src/hooks/useInventoryData';
import { useStockActions } from '../../src/hooks/useStockActions';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import type { Item } from '../../src/types/item';
import type { Container } from '../../src/types/container';
import type { Category } from '../../src/types/category';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { database } from '../../src/database/database';
import { setCategories } from '../../src/store/categorySlice';
import { setContainers } from '../../src/store/containersSlice';
import * as Sentry from '@sentry/react-native';
import { useRefreshStore } from '../../src/store/refreshStore';

interface StockFilters {
  search?: string;
  categoryId?: number;
  containerId?: number | 'none';
  status?: 'all' | 'available' | 'sold';
  minPrice?: number;
  maxPrice?: number;
}

interface StockData {
  items: Item[];
  categories: Category[];
  containers: Container[];
}

const QUERY_KEYS = {
  containers: 'containers',
  categories: 'categories',
  items: 'items'
} as const;

const CACHE_CONFIG = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 30 * 60 * 1000, // 30 minutes
  retry: 3,
} as const;

type QueryError = Error;

export default function StockScreen() {
  const [filter, setFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const [selectedContainer, setSelectedContainer] = useState<number | 'none' | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'available' | 'sold'>('all');
  const [priceRange, setPriceRange] = useState<{ min?: number; max?: number }>({});
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const refreshTimestamp = useRefreshStore(state => state.refreshTimestamp);
  
  // Récupérer les catégories depuis la base de données avec React Query
  const { 
    data: categories = [], 
    isLoading: categoriesLoading, 
    error: categoriesError 
  } = useQuery<Category[], QueryError>({
    queryKey: [QUERY_KEYS.categories, refreshTimestamp],
    queryFn: async () => {
      try {
        const data = await database.getCategories();
        // Mettre à jour le store Redux avec les catégories récupérées
        if (data && data.length > 0) {
          dispatch(setCategories(data));
        }
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
  
  // Récupérer les containers depuis la base de données avec React Query
  const { 
    data: containers = [], 
    isLoading: containersLoading, 
    error: containersError 
  } = useQuery<Container[], QueryError>({
    queryKey: [QUERY_KEYS.containers, refreshTimestamp],
    queryFn: async () => {
      try {
        const data = await database.getContainers();
        // Mettre à jour le store Redux avec les containers récupérés
        if (data && data.length > 0) {
          dispatch(setContainers(data));
        }
        return data || [];
      } catch (error) {
        if (error instanceof Error) {
          Sentry.captureException(error, {
            tags: { type: 'containers_fetch_error' }
          });
          throw error;
        }
        throw new Error('Erreur lors de la récupération des containers');
      }
    },
    ...CACHE_CONFIG
  });
  
  const { handleMarkAsSold, handleMarkAsAvailable } = useStockActions();
  
  const { data, isLoading: itemsLoading, error: itemsError, refetch } = useInventoryData({
    search: filter,
    categoryId: selectedCategory,
    containerId: selectedContainer,
    status: selectedStatus === 'all' ? undefined : selectedStatus,
    minPrice: priceRange.min,
    maxPrice: priceRange.max
  } as StockFilters);

  const items = (data as StockData)?.items || [];
  const isLoading = categoriesLoading || containersLoading || itemsLoading;
  const error = categoriesError || containersError || itemsError;

  const handleItemPress = useCallback((item: Item) => {
    setSelectedItem(item);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setSelectedItem(null);
    refetch();
    // Invalider les requêtes pour forcer le rechargement des données
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.items] });
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.categories] });
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.containers] });
  }, [refetch, queryClient]);

  const handleEditCancel = useCallback(() => {
    setSelectedItem(null);
  }, []);

  if (isLoading) {
    return (
      <ErrorBoundary>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Chargement des articles...</Text>
        </View>
      </ErrorBoundary>
    );
  }

  if (error) {
    return (
      <ErrorBoundary>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Une erreur est survenue lors du chargement des articles</Text>
        </View>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <FilterBar
          value={filter}
          onChangeText={setFilter}
          placeholder="Rechercher un article..."
          onCategoryChange={setSelectedCategory}
          onContainerChange={setSelectedContainer}
          onStatusChange={setSelectedStatus}
          onPriceChange={(min: number | undefined, max: number | undefined) => setPriceRange({ min, max })}
          categories={categories}
          containers={containers}
        />
        
        <ItemList
          items={items}
          onItemPress={handleItemPress}
          onMarkAsSold={handleMarkAsSold}
          onMarkAsAvailable={handleMarkAsAvailable}
          isLoading={isLoading}
          categories={categories}
          containers={containers}
          selectedItem={selectedItem}
          onEditSuccess={handleEditSuccess}
          onEditCancel={handleEditCancel}
        />
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingBottom: Platform.OS === 'ios' ? 85 : 65,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#007AFF',
    marginTop: 12,
    textAlign: 'center',
  },
});
