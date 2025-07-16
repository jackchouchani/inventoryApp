import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { fetchItems } from '../store/itemsThunks';
import { itemsAdapter } from '../store/itemsAdapter';
import { useAuth } from '../contexts/AuthContext';
import { testSupabaseConnection } from '../config/supabase';

// Créer le sélecteur avec RootState
const selectAllItems = itemsAdapter.getSelectors<RootState>((state) => state.items).selectAll;

interface UseItemsOptions {
  loadAll?: boolean; // Nouvelle option pour charger tous les items
}

export const useItems = (options: UseItemsOptions = {}) => {
  const { loadAll = false } = options;
  const dispatch = useDispatch<AppDispatch>();
  const { session, isLoading: authLoading } = useAuth();
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
      
      // Test de connexion Supabase avant de charger les données
      const connectionOk = await testSupabaseConnection();
      if (!connectionOk) {
        throw new Error('Impossible de se connecter à Supabase');
      }
      
      // Si loadAll est true, charger tous les items d'un coup
      if (loadAll) {
        await dispatch(fetchItems({ page: 0, limit: 10000 })).unwrap(); // Grande limite pour tout charger
      } else {
        // ✅ OFFLINE - Chargement intelligent avec détection de perte de données
        // Si c'est un chargement initial et qu'on n'a aucun item, charger une grande quantité
        // pour restaurer toutes les données depuis IndexedDB
        let limit, page;
        
        if (initialLoad && items.length === 0) {
          // Premier chargement sans données = charger tous les items (probablement après perte de données)
          console.log('[useItems] Chargement initial sans données, récupération complète');
          limit = 50000; // Grande limite pour tout récupérer
          page = 0;
        } else if (initialLoad) {
          // Premier chargement avec des données = chargement normal
          limit = 50;
          page = 0;
        } else {
          // Chargement de plus d'items = pagination normale
          limit = 20;
          page = Math.ceil(items.length / 20);
        }
        
        const result = await dispatch(fetchItems({ page, limit })).unwrap();
        console.log('[useItems] Items chargés avec succès:', result.items.length, 'items');
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

  // Déclenche le chargement initial dès que le status revient à 'idle'
  // Cela couvre le cas où un seul item est présent (par ex. suite à fetchItemById)
  useEffect(() => {
    // Attendre que l'auth soit prête avant de charger les items
    if (status === 'idle' && !authLoading) {
      loadItems(true);
    }
  }, [loadItems, status, authLoading]);

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