import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchBox, useInstantSearch, usePagination } from 'react-instantsearch';
import type { Item } from '../types/item';

export const useAlgoliaSearch = () => {
  const { query, refine: refineSearch } = useSearchBox();
  const { results, refresh, status } = useInstantSearch();
  const { refine: refinePage, currentRefinement: currentPage, isFirstPage, isLastPage } = usePagination();
  const [isInitialized] = useState(false);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const mountCount = useRef(0);
  const loadingPageRef = useRef(false);
  
  // S'assurer que la recherche est toujours initialisée quand on monte le composant
  useEffect(() => {
    mountCount.current += 1;
    
    // if (!isInitialized) {
    //   console.log(`[Algolia Debug] Initializing search with empty query`);
    //   // Forcer une recherche initiale sans filtre pour charger tous les résultats
    //   refinePage(0); // Commencer à la page 0
    //   refineSearch('');
    //   refresh();
    //   setIsInitialized(true);
    // }
    
    return () => {
    };
  }, [isInitialized, refineSearch, refresh, status, query, refinePage]);
  
  // Mettre à jour les items quand les résultats Algolia changent
  useEffect(() => {
    if (results && results.hits) {
      const newItems = transformHitsToItems(results.hits);
      
      // Si c'est la première page ou une nouvelle recherche, on remplace tout
      if (currentPage === 0) {
        setAllItems(newItems);
      } else {
        // Sinon on ajoute à ce qu'on a déjà
        setAllItems(prev => {
          // Éviter les doublons en filtrant par ID
          const existingIds = new Set(prev.map(item => item.id));
          const uniqueNewItems = newItems.filter(item => !existingIds.has(item.id));
          return [...prev, ...uniqueNewItems];
        });
      }
      
      // Réinitialiser le flag de chargement
      loadingPageRef.current = false;
    }
  }, [results, currentPage]);

  // Fonction de debounce pour optimiser les requêtes
  const debounce = useCallback(<F extends (...args: any[]) => any>(func: F, waitFor: number) => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<F>) => {
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
      timeout = setTimeout(() => func(...args), waitFor);
    };
  }, []);

  // Recherche avec debounce
  const debouncedSearch = useCallback(
    debounce((searchTerm: string) => {
      // Réinitialiser à la page 0 quand on fait une nouvelle recherche
      setAllItems([]); // Vider les résultats existants
      refinePage(0);
      refineSearch(searchTerm);
    }, 900),
    [refineSearch, refinePage]
  );

  // Fonction pour charger la page suivante
  const loadMore = useCallback(() => {
    // Vérifier si on est déjà en train de charger ou si on est à la dernière page
    if (loadingPageRef.current || isLastPage || status === 'loading' || status === 'stalled') {
      return;
    }
    
    const nextPage = currentPage + 1;
    
    // Marquer qu'on est en train de charger
    loadingPageRef.current = true;
    
    // Demander la page suivante
    refinePage(nextPage);
  }, [currentPage, refinePage, isLastPage, status]);

  // Transforme les hits en objets Item typés
  const transformHitsToItems = useCallback((hits: any[]): Item[] => {
    const validHits = hits.filter(hit => hit.doc_type === 'item');
    
    return validHits
      .map((hit: any) => {
        // Fonction de parsing sécurisé des dates
        const parseDateSafe = (dateString: string | null | undefined) => {
          if (!dateString) return new Date().toISOString();
          try {
            return new Date(dateString).toISOString();
          } catch (error) {
            return new Date().toISOString();
          }
        };
        
        const item: Item = {
          id: Number(hit.objectID),
          name: hit.name || '',
          description: hit.description || '',
          purchasePrice: typeof hit.purchase_price === 'string' ? parseFloat(hit.purchase_price) : (hit.purchase_price || 0),
          sellingPrice: typeof hit.selling_price === 'string' ? parseFloat(hit.selling_price) : (hit.selling_price || 0),
          status: hit.status || 'available',
          photo_storage_url: hit.photo_storage_url || null,
          qrCode: hit.qr_code || null,
          categoryId: hit.category_id || null,
          containerId: hit.container_id || null,
          createdAt: parseDateSafe(hit.created_at),
          updatedAt: parseDateSafe(hit.updated_at),
        };
        return item;
      });
  }, []);

  return {
    query,
    search: debouncedSearch,
    refineSearch,
    refresh,
    status,
    isLoading: status === 'loading' || status === 'stalled' || loadingPageRef.current,
    results,
    items: allItems,
    hasResults: results && results.nbHits > 0,
    nbHits: results?.nbHits || 0,
    currentPage,
    isLastPage,
    isFirstPage,
    loadMore
  };
}; 