import { useQuery, useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import { Container, Item, Category } from '../database/types';
import { handleDatabaseError } from '../utils/errorHandler';
import { PostgrestError } from '@supabase/supabase-js';

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
      items: itemsResponse.data as Item[],
      containers: containersResponse.data as Container[],
      categories: categoriesResponse.data as Category[]
    };
  } catch (error) {
    if (error instanceof Error || 'code' in (error as any)) {
      throw handleDatabaseError(error as Error | PostgrestError, 'fetchInventoryData');
    }
    throw error;
  }
};

// Hook pour récupérer toutes les données d'inventaire
export const useInventoryData = () => {
  return useQuery<InventoryData, Error>({
    queryKey: queryKeys.allInventoryData,
    queryFn: fetchInventoryData,
    staleTime: 30 * 1000, // 30 secondes
  });
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