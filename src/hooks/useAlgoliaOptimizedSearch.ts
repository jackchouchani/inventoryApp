import { useState, useEffect, useCallback, useRef } from 'react';
import algoliasearch from 'algoliasearch';
import { ALGOLIA_APP_ID, ALGOLIA_SEARCH_API_KEY, INDEX_NAME } from '../config/algolia';
import type { Item } from '../types/item';

// Configuration par défaut pour économiser les requêtes
const DEFAULT_CONFIG = {
  debounceMs: 400, // Attendre 400ms après la dernière frappe
  hitsPerPage: 20, // Limiter à 20 résultats par page
  minQueryLength: 2, // Minimum 2 caractères pour déclencher la recherche
};

// Client Algolia singleton
let searchClient: any;
let itemsIndex: any;

try {
  if (ALGOLIA_APP_ID && ALGOLIA_SEARCH_API_KEY) {
    searchClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_SEARCH_API_KEY);
    itemsIndex = searchClient.initIndex(INDEX_NAME);
    console.log('[Algolia] Client initialisé avec succès', { ALGOLIA_APP_ID, INDEX_NAME });
  }
} catch (error) {
  console.error('Erreur initialisation client Algolia:', error);
  searchClient = null;
  itemsIndex = null;
}

interface UseAlgoliaOptimizedSearchConfig {
  debounceMs?: number;
  hitsPerPage?: number;
  minQueryLength?: number;
  enabled?: boolean; // Permet de désactiver la recherche Algolia
}

interface AlgoliaSearchResult {
  items: Item[];
  isLoading: boolean;
  isSearching: boolean;
  error: string | null;
  hasMore: boolean;
  totalHits: number;
  currentPage: number;
  canLoadMore: boolean;
  loadMore: () => void;
  reset: () => void;
}

export const useAlgoliaOptimizedSearch = (
  searchQuery: string,
  config: UseAlgoliaOptimizedSearchConfig = {}
): AlgoliaSearchResult => {
  const {
    debounceMs = DEFAULT_CONFIG.debounceMs,
    hitsPerPage = DEFAULT_CONFIG.hitsPerPage,
    minQueryLength = DEFAULT_CONFIG.minQueryLength,
    enabled = true
  } = config;

  // États
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalHits, setTotalHits] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [canLoadMore, setCanLoadMore] = useState(false);

  // Refs pour gérer le debounce et éviter les race conditions
  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const searchCounterRef = useRef(0);
  const isLoadingMoreRef = useRef(false);

  // Fonction pour transformer les hits Algolia en Items
  const transformAlgoliaToItem = useCallback((hit: any): Item => {
    return {
      id: Number(hit.objectID),
      name: hit.name || '',
      description: hit.description || '',
      purchasePrice: typeof hit.purchase_price === 'string' 
        ? parseFloat(hit.purchase_price) 
        : (hit.purchase_price || 0),
      sellingPrice: typeof hit.selling_price === 'string' 
        ? parseFloat(hit.selling_price) 
        : (hit.selling_price || 0),
      status: hit.status || 'available',
      photo_storage_url: hit.photo_storage_url || undefined,
      qrCode: hit.qr_code || undefined,
      categoryId: hit.category_id || undefined,
      containerId: hit.container_id || null,
      createdAt: hit.created_at || new Date().toISOString(),
      updatedAt: hit.updated_at || new Date().toISOString(),
      soldAt: hit.sold_at || undefined
    };
  }, []);

  // Fonction de recherche Algolia simplifiée
  const performAlgoliaSearch = useCallback(async (
    query: string, 
    page: number = 0, 
    append: boolean = false
  ) => {
    if (!enabled || !itemsIndex) {
      console.warn('[Algolia] Search désactivé ou index non disponible', { enabled, itemsIndex: !!itemsIndex });
      return;
    }

    const searchId = ++searchCounterRef.current;
    
    try {
      if (!append) {
        setIsLoading(true);
        setError(null);
      } else {
        setIsSearching(true);
        isLoadingMoreRef.current = true;
      }

      console.log(`[Algolia] Recherche: "${query}" - Page: ${page} - Append: ${append}`);

      // Utiliser directement itemsIndex.search avec des options simples
      const searchOptions = {
        page,
        hitsPerPage,
        attributesToRetrieve: [
          'objectID',
          'name',
          'description',
          'category_name',
          'photo_storage_url',
          'selling_price',
          'purchase_price',
          'status',
          'qr_code',
          'category_id',
          'container_id',
          'container_reference',
          'created_at',
          'updated_at',
          'user_id'
        ],
        attributesToSnippet: ['*:20'],
        highlightPreTag: '<mark>',
        highlightPostTag: '</mark>'
      };

      console.log('[Algolia] Options de recherche:', searchOptions);

      // Utiliser itemsIndex.search directement
      const response = await itemsIndex.search(query.trim(), searchOptions);
      
      console.log('[Algolia] Réponse brute:', response);
      
      // Vérifier que c'est bien la dernière recherche (éviter les race conditions)
      if (searchId !== searchCounterRef.current) {
        console.log('[Algolia] Recherche obsolète, ignorée');
        return;
      }

      // Traiter la réponse directe d'itemsIndex
      if (response && response.hits) {
        const newItems = response.hits.map(transformAlgoliaToItem);
        
        console.log(`[Algolia] ${newItems.length} résultats trouvés (${response.nbHits} total)`);

        if (append) {
          setItems(prevItems => [...prevItems, ...newItems]);
        } else {
          setItems(newItems);
        }

        setTotalHits(response.nbHits || 0);
        setCurrentPage(page);
        setHasMore((page + 1) * hitsPerPage < (response.nbHits || 0));
        setCanLoadMore((page + 1) * hitsPerPage < (response.nbHits || 0));
      } else {
        console.log('[Algolia] Aucun résultat trouvé');
        if (!append) {
          setItems([]);
          setTotalHits(0);
          setHasMore(false);
          setCanLoadMore(false);
        }
      }
    } catch (err) {
      console.error('[Algolia] Erreur de recherche:', err);
      if (searchId === searchCounterRef.current) {
        setError('Erreur lors de la recherche');
        if (!append) {
          setItems([]);
          setTotalHits(0);
          setHasMore(false);
          setCanLoadMore(false);
        }
      }
    } finally {
      if (searchId === searchCounterRef.current) {
        setIsLoading(false);
        setIsSearching(false);
        isLoadingMoreRef.current = false;
      }
    }
  }, [enabled, itemsIndex, hitsPerPage, transformAlgoliaToItem]);

  // Fonction pour charger plus de résultats
  const loadMore = useCallback(() => {
    if (canLoadMore && !isLoadingMoreRef.current && searchQuery.trim().length >= minQueryLength) {
      performAlgoliaSearch(searchQuery.trim(), currentPage + 1, true);
    }
  }, [canLoadMore, searchQuery, currentPage, minQueryLength, performAlgoliaSearch]);

  // Fonction pour reset la recherche
  const reset = useCallback(() => {
    setItems([]);
    setIsLoading(false);
    setIsSearching(false);
    setError(null);
    setHasMore(false);
    setTotalHits(0);
    setCurrentPage(0);
    setCanLoadMore(false);
    searchCounterRef.current = 0;
    isLoadingMoreRef.current = false;
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  // Effet principal avec debounce optimisé
  useEffect(() => {
    // Nettoyer le timer précédent
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmedQuery = searchQuery.trim();
    
    // Log seulement si nécessaire (éviter les logs répétitifs)
    if (trimmedQuery.length === 0 || trimmedQuery.length === minQueryLength) {
      console.log('[Algolia] Query effect:', { trimmedQuery, length: trimmedQuery.length, minQueryLength });
    }

    // Si la requête est trop courte, vider les résultats immédiatement
    if (trimmedQuery.length < minQueryLength) {
      setItems([]);
      setIsLoading(false);
      setError(null);
      setTotalHits(0);
      setHasMore(false);
      setCanLoadMore(false);
      return;
    }

    // Débouncer la recherche
    debounceTimerRef.current = setTimeout(() => {
      console.log('[Algolia] Déclenchement recherche après debounce pour:', trimmedQuery);
      performAlgoliaSearch(trimmedQuery, 0, false);
    }, debounceMs);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, minQueryLength, debounceMs, performAlgoliaSearch]);

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    items,
    isLoading,
    isSearching,
    error,
    hasMore,
    totalHits,
    currentPage,
    canLoadMore,
    loadMore,
    reset
  };
}; 