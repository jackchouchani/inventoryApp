import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { fetchItems } from '../store/itemsThunks';
import { itemsAdapter } from '../store/itemsAdapter';

// Créer le sélecteur avec RootState
const selectAllItems = itemsAdapter.getSelectors<RootState>((state) => state.items).selectAll;

interface UseItemsOptions {
  loadAll?: boolean; // Nouvelle option pour charger tous les items
}

export const useItems = (options: UseItemsOptions = {}) => {
  const { loadAll = false } = options;
  const dispatch = useDispatch<AppDispatch>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Utiliser le sélecteur Redux pour obtenir les items
  const items = useSelector(selectAllItems);
  const status = useSelector((state: RootState) => state.items.status);
  const storeError = useSelector((state: RootState) => state.items.error);
  const pagination = useSelector((state: RootState) => state.items);

  const loadItems = useCallback(async (initialLoad = true) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Si loadAll est true, charger tous les items d'un coup
      if (loadAll) {
        console.log('[useItems] Chargement de TOUS les items');
        await dispatch(fetchItems({ page: 0, limit: 10000 })).unwrap(); // Grande limite pour tout charger
      } else {
        // Chargement intelligent : 50 items initialement, plus au besoin
        const limit = initialLoad ? 50 : 20;
        const page = initialLoad ? 0 : Math.ceil(items.length / 20);
        
        console.log(`[useItems] Chargement ${initialLoad ? 'initial' : 'supplémentaire'}: page ${page}, limit ${limit}`);
        await dispatch(fetchItems({ page, limit })).unwrap();
      }
    } catch (error) {
      console.error('Erreur lors du chargement des items:', error);
      setError('Erreur lors du chargement des items');
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, items.length, loadAll]);

  const loadMoreItems = useCallback(() => {
    if (!isLoading && pagination.hasMore) {
      loadItems(false);
    }
  }, [loadItems, isLoading, pagination.hasMore]);

  useEffect(() => {
    if (items.length === 0 && status === 'idle') {
      loadItems(true);
    }
  }, [loadItems, items.length, status]);

  // Synchroniser avec le status Redux
  useEffect(() => {
    setIsLoading(status === 'loading');
    setError(storeError);
  }, [status, storeError]);

  return {
    data: items,
    isLoading,
    error,
    refetch: () => loadItems(true),
    loadMore: loadMoreItems,
    hasMore: pagination.hasMore,
    total: pagination.totalItems
  };
}; 