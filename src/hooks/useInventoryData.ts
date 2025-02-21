import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import { Container } from '../types/container';
import { Item } from '../types/item';
import { Category } from '../types/category';
import { handleDatabaseError } from '../utils/errorHandler';
import { PostgrestError } from '@supabase/supabase-js';
import * as Sentry from '@sentry/react-native';
import { useNetworkStatus } from './useNetworkStatus';
import Toast from 'react-native-toast-message';
import { QUERY_KEYS } from '../constants/queryKeys';

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
        purchasePrice: parseFloat(item.purchase_price) || 0,
        sellingPrice: parseFloat(item.selling_price) || 0,
        status: item.status,
        photo_storage_url: item.photo_storage_url,
        containerId: item.container_id,
        categoryId: item.category_id,
        qrCode: item.qr_code,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        quantity: item.quantity || 1
      })),
      containers: (containersResponse.data || []).map(container => ({
        id: container.id,
        name: container.name,
        number: container.number,
        description: container.description,
        qrCode: container.qr_code,
        createdAt: container.created_at,
        updatedAt: container.updated_at,
        capacity: container.capacity || 0,
        currentItems: container.current_items || 0
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
    if (error instanceof PostgrestError) {
      handleDatabaseError(error);
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
  staleTime?: number;
  gcTime?: number;
  enabled?: boolean;
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

// Type pour les données de retour de useQuery
type QueryData = Item[] | null;

export function useInventoryData(filters: UseInventoryFilters) {
  const queryClient = useQueryClient();
  const { isConnected } = useNetworkStatus();

  return useQuery<InventoryData, Error>({
    queryKey: [QUERY_KEYS.INVENTORY, filters],
    queryFn: async () => {
      if (!isConnected) {
        throw new Error('Pas de connexion Internet');
      }

      try {
        const [itemsResponse, containersResponse, categoriesResponse] = await Promise.all([
          supabase
            .from('items')
            .select('*')
            .is('deleted', false)
            .order('created_at', { ascending: false }),
          supabase
            .from('containers')
            .select('*')
            .is('deleted', false)
            .order('created_at', { ascending: false }),
          supabase
            .from('categories')
            .select('*')
            .is('deleted', false)
            .order('created_at', { ascending: false })
        ]);

        if (itemsResponse.error) throw itemsResponse.error;
        if (containersResponse.error) throw containersResponse.error;
        if (categoriesResponse.error) throw categoriesResponse.error;

        return {
          items: (itemsResponse.data || []).map(item => ({
            ...item,
            purchasePrice: parseFloat(item.purchase_price) || 0,
            sellingPrice: parseFloat(item.selling_price) || 0,
            containerId: item.container_id,
            categoryId: item.category_id,
            createdAt: item.created_at,
            updatedAt: item.updated_at
          })),
          containers: containersResponse.data || [],
          categories: categoriesResponse.data || []
        };
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        Sentry.captureException(error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2
  });
}

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

        if (error) {
          handleDatabaseError(error);
          throw error;
        }
        return data as Item[];
      } catch (error) {
        if (error instanceof PostgrestError) {
          handleDatabaseError(error);
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
  const { isConnected } = useNetworkStatus();

  return useMutation<void, Error, MutationVariables>({
    mutationFn: async ({ id, data }) => {
      if (!isConnected) {
        throw new Error('Pas de connexion Internet');
      }

      const { error } = await supabase
        .from('items')
        .update(data)
        .eq('id', id);

      if (error) {
        Sentry.captureException(error, {
          tags: {
            location: 'useItemMutation',
            itemId: id.toString()
          }
        });
        throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.items });
      queryClient.invalidateQueries({ queryKey: queryKeys.allInventoryData });
      Toast.show({
        type: 'success',
        text1: 'Succès',
        text2: 'L\'item a été mis à jour avec succès'
      });
    },
    onError: (error) => {
      Toast.show({
        type: 'error',
        text1: 'Erreur de mise à jour',
        text2: error instanceof Error ? error.message : 'Une erreur est survenue'
      });
    },
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
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