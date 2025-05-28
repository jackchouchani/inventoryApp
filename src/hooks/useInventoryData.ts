import { useMemo } from 'react';
import { useItems } from './useItems';
import { useCategories } from './useCategories';
import { useContainers } from './useContainers';
import type { Item } from '../types/item';
import type { Container } from '../types/container';
import type { Category } from '../types/category';

interface UseInventoryFilters {
  search?: string;
  categoryId?: number;
  containerId?: number | 'none';
  status?: 'all' | 'available' | 'sold';
  minPrice?: number;
  maxPrice?: number;
  forceRefresh?: boolean;
}

interface InventoryData {
  items: Item[];
  containers: Container[];
  categories: Category[];
}

export function useInventoryData(filters: UseInventoryFilters) {
  const { data: items, isLoading: itemsLoading, error: itemsError, refetch: refetchItems } = useItems();
  const { categories, isLoading: categoriesLoading, error: categoriesError, loadCategories } = useCategories();
  const { data: containers, isLoading: containersLoading, error: containersError, refetch: refetchContainers } = useContainers();

  // Filtrer les items selon les critères
  const filteredItems = useMemo(() => {
    if (!items) return [];

    return items.filter(item => {
      // Filtre par recherche textuelle
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!item.name.toLowerCase().includes(searchLower) && 
            !(item.description || '').toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      // Filtre par catégorie
      if (filters.categoryId && item.categoryId !== filters.categoryId) {
        return false;
      }

      // Filtre par container
      if (filters.containerId !== undefined) {
        if (filters.containerId === 'none' && item.containerId) {
          return false;
        } else if (filters.containerId !== 'none' && item.containerId !== filters.containerId) {
          return false;
        }
      }

      // Filtre par statut
      if (filters.status && filters.status !== 'all' && item.status !== filters.status) {
        return false;
      }

      // Filtre par prix minimum
      if (filters.minPrice !== undefined && item.sellingPrice < filters.minPrice) {
        return false;
      }

      // Filtre par prix maximum
      if (filters.maxPrice !== undefined && item.sellingPrice > filters.maxPrice) {
        return false;
      }

      return true;
    });
  }, [items, filters]);

  const inventoryData: InventoryData = useMemo(() => ({
    items: filteredItems,
    containers: containers || [],
    categories: categories || []
  }), [filteredItems, containers, categories]);

  const isLoading = itemsLoading || categoriesLoading || containersLoading;
  const error = itemsError || categoriesError || containersError;

  const refetch = async () => {
    await Promise.all([
      refetchItems(),
      loadCategories(),
      refetchContainers()
    ]);
  };

  return {
    data: inventoryData,
    isLoading,
    error,
    refetch
  };
}

// Hook pour récupérer les items d'un container spécifique
export const useContainerItems = (containerId: number) => {
  const { data: items, isLoading, error } = useItems();

  const containerItems = useMemo(() => {
    if (!items || !containerId) return [];
    return items.filter(item => item.containerId === containerId);
  }, [items, containerId]);

  return {
    data: containerItems,
    isLoading,
    error
  };
};

// Les mutations sont maintenant gérées par Redux thunks
// Utiliser updateItemStatus et autres thunks depuis les composants 