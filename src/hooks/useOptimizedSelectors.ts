import { useSelector, useDispatch } from 'react-redux';
import { useMemo, useEffect, useState } from 'react';
import { RootState } from '../store/store';
import {
  selectFilteredItems,
  selectAllItems,
  selectAllCategories,
  selectAllContainers,
  selectAllLocations,
  selectItemStats,
  selectItemsByCategory,
  selectItemsByContainer,
  selectItemsByLocation,
  selectContainersByLocation,
  selectItemsLoading,
  selectItemsError,
  selectPaginationInfo,
  type ItemFilters
} from '../store/selectors';
import { fetchItems } from '../store/itemsThunks';
import { fetchLocations } from '../store/locationsThunks';
import { AppDispatch } from '../store/store';
import { useLocationsOptimized } from './useLocationsOptimized';
import { useContainersOptimized } from './useContainersOptimized';

/**
 * Hook optimisé pour récupérer les items filtrés avec memoization
 */
export const useFilteredItems = (filters?: ItemFilters) => {
  return useSelector((state: RootState) => 
    selectFilteredItems(state, filters || {})
  );
};

/**
 * Hook optimisé pour récupérer les items avec leurs relations (catégories et containers)
 */
export const useItemsWithRelations = (filters?: ItemFilters) => {
  const filteredItems = useSelector((state: RootState) => 
    selectFilteredItems(state, filters || {})
  );
  
  return filteredItems;
};

/**
 * Hook pour les statistiques d'items mémoïsées
 */
export const useItemStats = () => {
  return useSelector(selectItemStats);
};

/**
 * Hook pour les items groupés par catégorie
 */
export const useItemsByCategory = () => {
  return useSelector(selectItemsByCategory);
};

/**
 * Hook pour les items groupés par container
 */
export const useItemsByContainer = () => {
  return useSelector(selectItemsByContainer);
};

/**
 * Hook pour les items groupés par emplacement
 */
export const useItemsByLocation = () => {
  return useSelector(selectItemsByLocation);
};

/**
 * Hook pour les containers groupés par emplacement
 */
export const useContainersByLocation = () => {
  return useSelector(selectContainersByLocation);
};

/**
 * Hook pour récupérer toutes les catégories
 */
export const useAllCategories = () => {
  return useSelector(selectAllCategories);
};

/**
 * Hook pour récupérer tous les containers
 * Utilise le hook optimisé pour gérer le chargement automatique
 */
export const useAllContainers = () => {
  const { data } = useContainersOptimized();
  return data || [];
};

/**
 * Hook pour récupérer tous les emplacements
 * Déclenche le chargement si nécessaire et utilise le selector
 */
export const useAllLocations = () => {
  const dispatch = useDispatch<AppDispatch>();
  const locations = useSelector(selectAllLocations);
  const status = useSelector((state: RootState) => state.locations?.status || 'idle');
  
  useEffect(() => {
    console.log('[useAllLocations] Status:', status, 'Locations count:', locations.length);
    if (status === 'idle') {
      console.log('[useAllLocations] Dispatching fetchLocations...');
      dispatch(fetchLocations());
    }
  }, [dispatch, status, locations.length]);
  
  return locations || [];
};

/**
 * Hook pour l'état de chargement des items
 */
export const useItemsLoading = () => {
  return useSelector(selectItemsLoading);
};

/**
 * Hook pour les erreurs des items
 */
export const useItemsError = () => {
  return useSelector(selectItemsError);
};

/**
 * Hook pour les informations de pagination
 */
export const usePaginationInfo = () => {
  return useSelector(selectPaginationInfo);
};

/**
 * Hook combiné pour la page stock - optimisé pour éviter les re-renders
 */
export const useStockPageData = (filters?: ItemFilters) => {
  const items = useFilteredItems(filters);
  const categories = useAllCategories();
  const containers = useAllContainers();
  const locations = useAllLocations();
  const isLoading = useItemsLoading();
  const error = useItemsError();
  const pagination = usePaginationInfo();

  // Mémoïser les données pour éviter les re-renders inutiles
  const memoizedData = useMemo(() => ({
    items,
    categories,
    containers,
    locations,
    isLoading,
    error,
    pagination,
  }), [items, categories, containers, locations, isLoading, error, pagination]);

  return memoizedData;
};

/**
 * Hook spécifique pour les containers - Force le chargement de TOUS les items
 */
export const useContainerPageData = (filters?: ItemFilters) => {
  const dispatch = useDispatch<AppDispatch>();
  const allItems = useSelector(selectAllItems);
  const categories = useAllCategories();
  const containers = useAllContainers();
  const locations = useAllLocations();
  const isLoading = useItemsLoading();
  const error = useItemsError();
  const { totalItems, hasMore } = useSelector((state: RootState) => state.items);
  
  // Force le chargement de TOUS les items si ce n'est pas déjà fait
  useEffect(() => {
    const loadAllItems = async () => {
      if (hasMore && allItems.length < totalItems) {
        console.log('[useContainerPageData] Chargement de TOUS les items pour containers');
        try {
          await dispatch(fetchItems({ page: 0, limit: 10000 })).unwrap();
        } catch (error) {
          console.error('[useContainerPageData] Erreur chargement items:', error);
        }
      }
    };

    loadAllItems();
  }, [dispatch, hasMore, allItems.length, totalItems]);

  // Appliquer les filtres et tri aux items
  const filteredItems = useMemo(() => {
    if (!filters) return allItems;
    
    const filtered = allItems.filter(item => {
      // Filtre par statut
      if (filters.status && filters.status !== 'all' && item.status !== filters.status) {
        return false;
      }
      
      // Filtre par recherche
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        if (!item.name.toLowerCase().includes(query) && 
            !(item.description || '').toLowerCase().includes(query)) {
          return false;
        }
      }
      
      // Filtre par catégorie
      if (filters.categoryId && item.categoryId !== filters.categoryId) {
        return false;
      }
      
      // Filtre par container
      if (filters.containerId !== undefined) {
        if (filters.containerId === null && item.containerId !== null) {
          return false;
        } else if (filters.containerId !== null && item.containerId !== filters.containerId) {
          return false;
        }
      }
      
      // Filtre par emplacement
      if (filters.locationId !== undefined) {
        if (filters.locationId === null && item.locationId !== null) {
          return false;
        } else if (filters.locationId !== null && item.locationId !== filters.locationId) {
          return false;
        }
      }
      
      return true;
    });

    // Tri spécial pour les items vendus : tri par date de vente (plus récent en premier)
    if (filters.status === 'sold') {
      return filtered.sort((a, b) => {
        // Si un item n'a pas de soldAt, le mettre à la fin
        if (!a.soldAt && !b.soldAt) return 0;
        if (!a.soldAt) return 1;
        if (!b.soldAt) return -1;
        
        // Tri décroissant : date la plus récente en premier
        return new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime();
      });
    }

    return filtered;
  }, [allItems, filters]);

  return useMemo(() => ({
    items: filteredItems,
    categories,
    containers,
    locations,
    isLoading,
    error,
    totalItems: allItems.length,
    hasMore,
  }), [filteredItems, categories, containers, locations, isLoading, error, allItems.length, hasMore]);
};

/**
 * Hook spécifique pour les emplacements - Force le chargement de TOUS les items et containers
 */
export const useLocationPageData = (filters?: ItemFilters) => {
  const dispatch = useDispatch<AppDispatch>();
  const allItems = useSelector(selectAllItems);
  const categories = useAllCategories();
  const containers = useAllContainers();
  const locations = useAllLocations();
  const isLoading = useItemsLoading();
  const error = useItemsError();
  const { totalItems, hasMore } = useSelector((state: RootState) => state.items);
  
  // Force le chargement de TOUS les items si ce n'est pas déjà fait
  useEffect(() => {
    const loadAllItems = async () => {
      if (hasMore && allItems.length < totalItems) {
        console.log('[useLocationPageData] Chargement de TOUS les items pour emplacements');
        try {
          await dispatch(fetchItems({ page: 0, limit: 10000 })).unwrap();
        } catch (error) {
          console.error('[useLocationPageData] Erreur chargement items:', error);
        }
      }
    };

    loadAllItems();
  }, [dispatch, hasMore, allItems.length, totalItems]);

  // Appliquer les filtres et tri aux items
  const filteredItems = useMemo(() => {
    if (!filters) return allItems;
    
    const filtered = allItems.filter(item => {
      // Filtre par statut
      if (filters.status && filters.status !== 'all' && item.status !== filters.status) {
        return false;
      }
      
      // Filtre par recherche
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        if (!item.name.toLowerCase().includes(query) && 
            !(item.description || '').toLowerCase().includes(query)) {
          return false;
        }
      }
      
      // Filtre par catégorie
      if (filters.categoryId && item.categoryId !== filters.categoryId) {
        return false;
      }
      
      // Filtre par container
      if (filters.containerId !== undefined) {
        if (filters.containerId === null && item.containerId !== null) {
          return false;
        } else if (filters.containerId !== null && item.containerId !== filters.containerId) {
          return false;
        }
      }
      
      // Filtre par emplacement
      if (filters.locationId !== undefined) {
        if (filters.locationId === null && item.locationId !== null) {
          return false;
        } else if (filters.locationId !== null && item.locationId !== filters.locationId) {
          return false;
        }
      }
      
      return true;
    });

    // Tri spécial pour les items vendus : tri par date de vente (plus récent en premier)
    if (filters.status === 'sold') {
      return filtered.sort((a, b) => {
        // Si un item n'a pas de soldAt, le mettre à la fin
        if (!a.soldAt && !b.soldAt) return 0;
        if (!a.soldAt) return 1;
        if (!b.soldAt) return -1;
        
        // Tri décroissant : date la plus récente en premier
        return new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime();
      });
    }

    return filtered;
  }, [allItems, filters]);

  return useMemo(() => ({
    items: filteredItems,
    categories,
    containers,
    locations,
    isLoading,
    error,
    totalItems: allItems.length,
    hasMore,
  }), [filteredItems, categories, containers, locations, isLoading, error, allItems.length, hasMore]);
};

/**
 * Hook optimisé pour les filtres de recherche avec debouncing
 */
export const useSearchFilters = (searchQuery: string, otherFilters?: Partial<ItemFilters>) => {
  const filters = useMemo(() => ({
    ...otherFilters,
    searchQuery: searchQuery.trim(),
  }), [searchQuery, otherFilters]);

  return useFilteredItems(filters);
};

/**
 * Hook pour les données des tableaux de bord avec statistiques
 */
export const useDashboardData = () => {
  const stats = useItemStats();
  const itemsByCategory = useItemsByCategory();
  const itemsByContainer = useItemsByContainer();
  const itemsByLocation = useItemsByLocation();
  const containersByLocation = useContainersByLocation();
  const isLoading = useItemsLoading();

  return useMemo(() => ({
    stats,
    itemsByCategory,
    itemsByContainer,
    itemsByLocation,
    containersByLocation,
    isLoading,
  }), [stats, itemsByCategory, itemsByContainer, itemsByLocation, containersByLocation, isLoading]);
};

/**
 * Hook pour optimiser les listes avec pagination
 */
export const usePaginatedItems = (filters?: ItemFilters, pageSize: number = 50) => {
  const allItems = useFilteredItems(filters);
  const pagination = usePaginationInfo();
  
  const paginatedData = useMemo(() => {
    const startIndex = 0;
    const endIndex = pagination.currentPage * pageSize;
    
    return {
      items: allItems.slice(startIndex, endIndex),
      hasMore: pagination.hasMore,
      currentPage: pagination.currentPage,
      totalItems: pagination.totalItems,
      isAtEnd: endIndex >= allItems.length,
    };
  }, [allItems, pagination, pageSize]);

  return paginatedData;
};

// Hook pour la recherche globale (charge tous les items si nécessaire)
export const useGlobalSearch = (searchQuery: string) => {
  const dispatch = useDispatch<AppDispatch>();
  const allItems = useSelector(selectAllItems);
  const { totalItems, hasMore } = useSelector((state: RootState) => state.items);
  const [isSearching, setIsSearching] = useState(false);
  
  // Si on fait une recherche et qu'on n'a pas tous les items, les charger
  useEffect(() => {
    const loadAllItemsForSearch = async () => {
      if (searchQuery.trim() && hasMore && allItems.length < totalItems) {
        console.log('[useGlobalSearch] Chargement de tous les items pour la recherche');
        setIsSearching(true);
        try {
          // Charger tous les items restants
          await dispatch(fetchItems({ page: 0, limit: totalItems })).unwrap();
        } catch (error) {
          console.error('[useGlobalSearch] Erreur chargement items:', error);
        } finally {
          setIsSearching(false);
        }
      }
    };

    loadAllItemsForSearch();
  }, [searchQuery, hasMore, allItems.length, totalItems, dispatch]);

  // Filtrer les items avec la recherche
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return allItems;
    
    const query = searchQuery.toLowerCase();
    return allItems.filter(item => 
      item.name.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query)
    );
  }, [allItems, searchQuery]);

  return {
    items: searchResults,
    isSearching,
    total: searchResults.length
  };
};

// Export du hook Algolia optimisé pour réutilisation
export { useAlgoliaOptimizedSearch } from './useAlgoliaOptimizedSearch'; 