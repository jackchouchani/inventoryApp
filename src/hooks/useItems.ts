import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { fetchItems } from '../store/itemsThunks';
import { itemsAdapter } from '../store/itemsAdapter';

// Créer le sélecteur avec RootState
const selectAllItems = itemsAdapter.getSelectors<RootState>((state) => state.items).selectAll;

export const useItems = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Utiliser le sélecteur Redux pour obtenir les items
  const items = useSelector(selectAllItems);
  const status = useSelector((state: RootState) => state.items.status);
  const storeError = useSelector((state: RootState) => state.items.error);

  const loadItems = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await dispatch(fetchItems({ page: 0, limit: 1000 })).unwrap();
    } catch (error) {
      console.error('Erreur lors du chargement des items:', error);
      setError('Erreur lors du chargement des items');
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    if (items.length === 0 && status === 'idle') {
      loadItems();
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
    refetch: loadItems
  };
}; 