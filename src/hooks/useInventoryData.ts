import { useQuery, useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import { Container, Item, Category } from '../database/types';
import { handleDatabaseError } from '../utils/errorHandler';
import { PostgrestError } from '@supabase/supabase-js';
import { useInfiniteQuery, useQueries } from '@tanstack/react-query';
import { getItems, getCategories, getContainers } from '../database/database';
import { useDispatch, useSelector } from 'react-redux';
import { setItems } from '../store/itemsSlice';
import { setCategories } from '../store/categorySlice';
import { setContainers } from '../store/containersSlice';
import { fetchItems, fetchSimilarItems } from '../store/itemsThunks';
import { 
  selectSearchResults, 
  selectItemsStatus, 
  selectItemsError,
  selectHasMore,
  selectCurrentPage,
  selectTotalItemsCount
} from '../store/itemsSlice';
import { 
  selectAllCategories,
  selectCategoriesStatus,
  selectCategoriesError 
} from '../store/categorySlice';
import { 
  selectAllContainers,
  selectContainersStatus,
  selectContainersError 
} from '../store/containersSlice';
import { SearchFilters } from '../services/searchService';
import { useEffect, useCallback, useState } from 'react';
import { AppDispatch } from '../store/store';

const PAGE_SIZE = 20;

interface FetchItemsResponse {
  items: Item[];
  nextCursor?: number;
  hasMore: boolean;
}

interface UseInventoryFilters {
  search?: string;
  categoryId?: number;
  containerId?: number | 'none';
  status?: 'all' | 'available' | 'sold';
  minPrice?: number;
  maxPrice?: number;
}

interface InventoryData {
  items: Item[];
  containers: Container[];
  categories: Category[];
}

// Clés de requête
export const queryKeys = {
  items: ['items'] as const,
  containers: ['containers'] as const,
  categories: ['categories'] as const,
  itemsByContainer: (containerId: number) => ['items', 'container', containerId] as const,
  containerDetails: (containerId: number) => ['containers', containerId] as const,
  allInventoryData: ['inventory', 'all'] as const,
};

// Fonction pour récupérer toutes les données d'inventaire
const fetchInventoryData = async (): Promise<InventoryData> => {
  try {
    const [itemsResponse, containersResponse, categoriesResponse] = await Promise.all([
      supabase.from('items').select('*').is('deleted', false),
      supabase.from('containers').select('*').is('deleted', false),
      supabase.from('categories').select('*').is('deleted', false)
    ]);

    if (itemsResponse.error) throw itemsResponse.error;
    if (containersResponse.error) throw containersResponse.error;
    if (categoriesResponse.error) throw categoriesResponse.error;

    return {
      items: (itemsResponse.data || []).map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        purchasePrice: item.purchase_price,
        sellingPrice: item.selling_price,
        status: item.status,
        photoUri: item.photo_uri,
        containerId: item.container_id,
        categoryId: item.category_id,
        qrCode: item.qr_code,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      })),
      containers: (containersResponse.data || []).map(container => ({
        id: container.id,
        name: container.name,
        number: container.number,
        description: container.description,
        qrCode: container.qr_code,
        createdAt: container.created_at,
        updatedAt: container.updated_at
      })),
      categories: (categoriesResponse.data || []).map(category => ({
        id: category.id,
        name: category.name,
        description: category.description,
        createdAt: category.created_at,
        updatedAt: category.updated_at
      }))
    };
  } catch (error) {
    if (error instanceof Error || 'code' in (error as any)) {
      throw handleDatabaseError(error as Error | PostgrestError, 'fetchInventoryData');
    }
    throw error;
  }
};

interface UseInventoryDataParams {
  search?: string;
  categoryId?: number;
  containerId?: number | 'none';
  status?: 'available' | 'sold';
  minPrice?: number;
  maxPrice?: number;
}

interface UseInventoryDataResult {
  items: Item[];
  categories: Category[];
  containers: Container[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  totalCount: number;
  fetchNextPage: () => Promise<void>;
  refetch: () => Promise<void>;
}

export const useInventoryData = (params: UseInventoryDataParams = {}): UseInventoryDataResult => {
  const queryClient = useQueryClient();

  const {
    data: itemsData,
    isLoading: isItemsLoading,
    error: itemsError,
    refetch: refetchItems
  } = useQuery({
    queryKey: [...queryKeys.items, params],
    queryFn: async () => {
      try {
        let query = supabase
          .from('items')
          .select('*')
          .is('deleted', false)
          .order('created_at', { ascending: false });

        if (params?.search) {
          query = query.ilike('name', `%${params.search}%`);
        }

        if (params?.categoryId) {
          query = query.eq('category_id', params.categoryId);
        }

        if (params?.containerId) {
          if (params.containerId === 'none') {
            query = query.is('container_id', null);
          } else {
            query = query.eq('container_id', params.containerId);
          }
        }

        if (params?.status) {
          query = query.eq('status', params.status);
        }

        if (params?.minPrice) {
          query = query.gte('selling_price', params.minPrice);
        }

        if (params?.maxPrice) {
          query = query.lte('selling_price', params.maxPrice);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching items:', error);
        throw error;
      }
    },
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5 // 5 minutes
  });

  const {
    data: categoriesData,
    isLoading: isCategoriesLoading
  } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .is('deleted', false);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10 // 10 minutes
  });

  const {
    data: containersData,
    isLoading: isContainersLoading
  } = useQuery({
    queryKey: queryKeys.containers,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('containers')
        .select('*')
        .is('deleted', false);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10 // 10 minutes
  });

  const refetch = useCallback(async () => {
    await Promise.all([
      refetchItems(),
      queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
      queryClient.invalidateQueries({ queryKey: queryKeys.containers })
    ]);
  }, [refetchItems, queryClient]);

  const fetchNextPage = useCallback(async () => {
    // Pour l'instant, on ne gère pas la pagination car on charge tout
    return Promise.resolve();
  }, []);

  return {
    items: itemsData || [],
    categories: categoriesData || [],
    containers: containersData || [],
    isLoading: isItemsLoading || isCategoriesLoading || isContainersLoading,
    error: itemsError as Error | null,
    hasMore: false,
    totalCount: itemsData?.length || 0,
    fetchNextPage,
    refetch
  };
};

// Hook pour récupérer les items d'un container spécifique
export const useContainerItems = (containerId: number) => {
  return useQuery<Item[], Error>({
    queryKey: queryKeys.itemsByContainer(containerId),
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .eq('container_id', containerId)
          .is('deleted', false);

        if (error) throw error;
        return data as Item[];
      } catch (error) {
        if (error instanceof Error || 'code' in (error as any)) {
          throw handleDatabaseError(error as Error | PostgrestError, 'useContainerItems');
        }
        throw error;
      }
    },
    enabled: !!containerId,
  });
};

interface MutationVariables {
  id: number;
  data: Partial<Item> | Partial<Container>;
}

// Hook pour les mutations d'items
export const useItemMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, MutationVariables>({
    mutationFn: async ({ id, data }) => {
      const { error } = await supabase
        .from('items')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.items });
      queryClient.invalidateQueries({ queryKey: queryKeys.allInventoryData });
    },
  });
};

// Hook pour les mutations de containers
export const useContainerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, MutationVariables>({
    mutationFn: async ({ id, data }) => {
      const { error } = await supabase
        .from('containers')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.containers });
      queryClient.invalidateQueries({ queryKey: queryKeys.containerDetails(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.allInventoryData });
    },
  });
};

// Hook pour précharger les données d'un container
export const usePrefetchContainerData = (containerId: number) => {
  const queryClient = useQueryClient();

  const prefetchData = async () => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.containerDetails(containerId),
      queryFn: async () => {
        const { data, error } = await supabase
          .from('containers')
          .select('*')
          .eq('id', containerId)
          .single();

        if (error) throw error;
        return data as Container;
      }
    });

    await queryClient.prefetchQuery({
      queryKey: queryKeys.itemsByContainer(containerId),
      queryFn: async () => {
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .eq('container_id', containerId)
          .is('deleted', false);

        if (error) throw error;
        return data as Item[];
      }
    });
  };

  return prefetchData;
}; 