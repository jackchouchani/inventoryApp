import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { imageService } from '../services/imageService';
import { supabase } from '../config/supabase';
import { Database } from '../types/database';

const PAGE_SIZE = 20;

type Tables = Database['public']['Tables'];
type DbItem = Tables['items']['Row'];
type DbContainer = Tables['containers']['Row'];
type DbCategory = Tables['categories']['Row'];

interface ItemsPage {
  items: DbItem[];
  nextPage: number | undefined;
}

// Fonction utilitaire pour le typage des requêtes Supabase
const createQuery = <T extends keyof Tables>(table: T) => {
  return supabase.from(table) as any; // Utilisation temporaire de any pour contourner les problèmes de typage
};

export const useOptimizedQueries = () => {
  const queryClient = useQueryClient();

  // Requête paginée pour les items avec mise en cache optimisée
  const useItems = (enabled: boolean = true) => {
    return useInfiniteQuery<ItemsPage>({
      queryKey: ['items'],
      queryFn: async ({ pageParam = 0 }) => {
        const currentPage = Number(pageParam);
        const { data: items, error } = await createQuery('items')
          .select()
          .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1)
          .order('updated_at', { ascending: false });

        if (error) throw error;

        return {
          items: items as DbItem[] || [],
          nextPage: items?.length === PAGE_SIZE ? currentPage + 1 : undefined
        };
      },
      initialPageParam: 0,
      getNextPageParam: (lastPage) => lastPage.nextPage,
      enabled,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false
    });
  };

  // Requête optimisée pour un item spécifique
  const useItem = (id: number) => {
    return useQuery<DbItem>({
      queryKey: ['item', id],
      queryFn: async () => {
        const { data, error } = await createQuery('items')
          .select()
          .eq('id', id)
          .single();

        if (error) throw error;
        return data as DbItem;
      },
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false
    });
  };

  // Requête optimisée pour les containers
  const useContainers = () => {
    return useQuery<DbContainer[]>({
      queryKey: ['containers'],
      queryFn: async () => {
        const { data, error } = await createQuery('containers')
          .select()
          .order('name');

        if (error) throw error;
        return data as DbContainer[] || [];
      },
      staleTime: 10 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      refetchOnWindowFocus: false
    });
  };

  // Requête optimisée pour les catégories
  const useCategories = () => {
    return useQuery<DbCategory[]>({
      queryKey: ['categories'],
      queryFn: async () => {
        const { data, error } = await createQuery('categories')
          .select()
          .order('name');

        if (error) throw error;
        return data as DbCategory[] || [];
      },
      staleTime: 30 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: false
    });
  };

  // Recherche optimisée d'items avec debounce
  const useSearchItems = (query: string, enabled: boolean = true) => {
    return useQuery<DbItem[]>({
      queryKey: ['items', 'search', query],
      queryFn: async () => {
        const { data, error } = await createQuery('items')
          .select()
          .ilike('name', `%${query}%`)
          .limit(10);

        if (error) throw error;
        return data as DbItem[] || [];
      },
      enabled: enabled && query.length >= 2,
      staleTime: 2 * 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false
    });
  };

  // Préchargement intelligent des données
  const prefetchData = async () => {
    await Promise.all([
      queryClient.prefetchInfiniteQuery({
        queryKey: ['items'],
        queryFn: async () => {
          const { data, error } = await createQuery('items')
            .select()
            .range(0, PAGE_SIZE - 1)
            .order('updated_at', { ascending: false });

          if (error) throw error;
          return {
            items: data as DbItem[] || [],
            nextPage: data?.length === PAGE_SIZE ? 1 : undefined
          };
        },
        initialPageParam: 0
      }),
      queryClient.prefetchQuery({
        queryKey: ['containers'],
        queryFn: async () => {
          const { data, error } = await createQuery('containers')
            .select()
            .order('name');

          if (error) throw error;
          return data as DbContainer[] || [];
        }
      }),
      queryClient.prefetchQuery({
        queryKey: ['categories'],
        queryFn: async () => {
          const { data, error } = await createQuery('categories')
            .select()
            .order('name');

          if (error) throw error;
          return data as DbCategory[] || [];
        }
      })
    ]);
  };

  // Invalidation intelligente du cache
  const invalidateQueries = async (type: 'item' | 'container' | 'category', id?: number) => {
    if (id) {
      await queryClient.invalidateQueries({ queryKey: [type, id] });
    }
    await queryClient.invalidateQueries({ queryKey: [type + 's'] });
  };

  return {
    useItems,
    useItem,
    useContainers,
    useCategories,
    useSearchItems,
    prefetchData,
    invalidateQueries
  };
};

// Hook pour la gestion optimisée des images
export const useOptimizedImage = (path: string | undefined, useThumbnail: boolean = false) => {
  return useQuery<string>({
    queryKey: ['image', path, useThumbnail],
    queryFn: () => imageService.getImage(path!, useThumbnail),
    enabled: !!path,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false
  });
}; 