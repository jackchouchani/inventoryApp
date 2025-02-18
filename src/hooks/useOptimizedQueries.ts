import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { database } from '../database/database';
import { imageService } from '../services/imageService';
import type { Item } from '../types/item';
import type { Container } from '../types/container';
import type { Category } from '../types/category';

const PAGE_SIZE = 20;

interface ItemsPage {
  items: Item[];
  nextPage: number | undefined;
}

export const useOptimizedQueries = () => {
  const queryClient = useQueryClient();

  // Requête paginée pour les items
  const useItems = (enabled: boolean = true) => {
    return useInfiniteQuery<ItemsPage, Error>({
      queryKey: ['items'],
      queryFn: async ({ pageParam }) => {
        const start = (pageParam as number) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        
        const items = await database.getItems();
        const pageItems = items.slice(start, end);

        // Précharger les thumbnails en parallèle
        await Promise.all(
          pageItems
            .filter(item => item.photoUri)
            .map(item => imageService.getImage(item.photoUri!, true))
        );

        return {
          items: pageItems,
          nextPage: items.length > end ? (pageParam as number) + 1 : undefined
        };
      },
      getNextPageParam: (lastPage: ItemsPage) => lastPage.nextPage,
      enabled,
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
      initialPageParam: 0
    });
  };

  // Requête optimisée pour un item spécifique
  const useItem = (id: number) => {
    return useQuery<Item | null, Error>({
      queryKey: ['item', id],
      queryFn: async () => {
        const item = await database.getItem(id);
        if (item?.photoUri) {
          // Précharger l'image complète
          await imageService.getImage(item.photoUri);
        }
        return item;
      },
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000
    });
  };

  // Requête optimisée pour les containers
  const useContainers = () => {
    return useQuery<Container[], Error>({
      queryKey: ['containers'],
      queryFn: database.getContainers,
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 60 * 60 * 1000, // 1 heure
      refetchOnWindowFocus: false
    });
  };

  // Requête optimisée pour les catégories
  const useCategories = () => {
    return useQuery<Category[], Error>({
      queryKey: ['categories'],
      queryFn: database.getCategories,
      staleTime: 30 * 60 * 1000, // 30 minutes
      gcTime: 24 * 60 * 60 * 1000, // 24 heures
      refetchOnWindowFocus: false
    });
  };

  // Recherche optimisée d'items
  const useSearchItems = (query: string, enabled: boolean = true) => {
    return useQuery<Item[], Error>({
      queryKey: ['items', 'search', query],
      queryFn: () => database.searchItems(query),
      enabled: enabled && query.length >= 2,
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: false
    });
  };

  // Préchargement des données
  const prefetchData = async () => {
    await Promise.all([
      queryClient.prefetchInfiniteQuery({
        queryKey: ['items'],
        queryFn: () => database.getItems(),
        initialPageParam: 0
      }),
      queryClient.prefetchQuery({
        queryKey: ['containers'],
        queryFn: database.getContainers,
        staleTime: 10 * 60 * 1000
      }),
      queryClient.prefetchQuery({
        queryKey: ['categories'],
        queryFn: database.getCategories,
        staleTime: 30 * 60 * 1000
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
  return useQuery<string, Error>({
    queryKey: ['image', path, useThumbnail],
    queryFn: () => imageService.getImage(path!, useThumbnail),
    enabled: !!path,
    staleTime: 24 * 60 * 60 * 1000, // 24 heures
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 jours
    refetchOnWindowFocus: false
  });
}; 