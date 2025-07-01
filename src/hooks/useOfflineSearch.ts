import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineSearchService } from '../services/OfflineSearchService';
import { useDebouncedCallback } from 'use-debounce';

interface SearchState<T> {
  results: T[];
  isLoading: boolean;
  error: string | null;
  total: number;
  fromCache: boolean;
  searchTime: number;
}

interface UseOfflineSearchOptions {
  debounceMs?: number;
  minQueryLength?: number;
  autoSearch?: boolean;
  limit?: number;
  threshold?: number;
}

interface UseOfflineSearchReturn<T> {
  // État de la recherche
  results: T[];
  isLoading: boolean;
  error: string | null;
  total: number;
  fromCache: boolean;
  searchTime: number;
  
  // Actions
  search: (query: string) => Promise<void>;
  clearResults: () => void;
  retry: () => Promise<void>;
  
  // État de la query
  query: string;
  setQuery: (query: string) => void;
}

/**
 * Hook pour la recherche offline/online d'items
 */
export function useOfflineItemSearch(
  initialQuery: string = '',
  options: UseOfflineSearchOptions = {}
): UseOfflineSearchReturn<any> {
  const {
    debounceMs = 300,
    minQueryLength = 2,
    autoSearch = true,
    limit = 50,
    threshold = 0.3
  } = options;

  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<SearchState<any>>({
    results: [],
    isLoading: false,
    error: null,
    total: 0,
    fromCache: false,
    searchTime: 0
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    // Annuler la recherche précédente si elle est en cours
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (searchQuery.length < minQueryLength) {
      setState(prev => ({
        ...prev,
        results: [],
        total: 0,
        isLoading: false,
        error: null
      }));
      return;
    }

    abortControllerRef.current = new AbortController();
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await offlineSearchService.searchItems(searchQuery, {
        limit,
        threshold
      });

      setState({
        results: result.items,
        total: result.total,
        fromCache: result.fromCache,
        searchTime: result.searchTime,
        isLoading: false,
        error: null
      });

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error.message || 'Erreur lors de la recherche'
        }));
      }
    }
  }, [minQueryLength, limit, threshold]);

  // Recherche avec debounce
  const debouncedSearch = useDebouncedCallback(performSearch, debounceMs);

  // Recherche manuelle (sans debounce)
  const search = useCallback(async (searchQuery: string) => {
    setQuery(searchQuery);
    await performSearch(searchQuery);
  }, [performSearch]);

  // Auto-recherche quand la query change
  useEffect(() => {
    if (autoSearch) {
      debouncedSearch(query);
    }
  }, [query, debouncedSearch, autoSearch]);

  const clearResults = useCallback(() => {
    setQuery('');
    setState({
      results: [],
      isLoading: false,
      error: null,
      total: 0,
      fromCache: false,
      searchTime: 0
    });
  }, []);

  const retry = useCallback(async () => {
    if (query) {
      await performSearch(query);
    }
  }, [query, performSearch]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // État
    results: state.results,
    isLoading: state.isLoading,
    error: state.error,
    total: state.total,
    fromCache: state.fromCache,
    searchTime: state.searchTime,
    
    // Actions
    search,
    clearResults,
    retry,
    
    // Query
    query,
    setQuery
  };
}

/**
 * Hook pour la recherche offline/online de containers
 */
export function useOfflineContainerSearch(
  initialQuery: string = '',
  options: UseOfflineSearchOptions = {}
): UseOfflineSearchReturn<any> {
  const {
    debounceMs = 300,
    minQueryLength = 1,
    autoSearch = true,
    limit = 50
  } = options;

  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<SearchState<any>>({
    results: [],
    isLoading: false,
    error: null,
    total: 0,
    fromCache: false,
    searchTime: 0
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (searchQuery.length < minQueryLength) {
      setState(prev => ({
        ...prev,
        results: [],
        total: 0,
        isLoading: false,
        error: null
      }));
      return;
    }

    abortControllerRef.current = new AbortController();
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await offlineSearchService.searchContainers(searchQuery, { limit });

      setState({
        results: result.items,
        total: result.total,
        fromCache: result.fromCache,
        searchTime: result.searchTime,
        isLoading: false,
        error: null
      });

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error.message || 'Erreur lors de la recherche'
        }));
      }
    }
  }, [minQueryLength, limit]);

  const debouncedSearch = useDebouncedCallback(performSearch, debounceMs);

  const search = useCallback(async (searchQuery: string) => {
    setQuery(searchQuery);
    await performSearch(searchQuery);
  }, [performSearch]);

  useEffect(() => {
    if (autoSearch) {
      debouncedSearch(query);
    }
  }, [query, debouncedSearch, autoSearch]);

  const clearResults = useCallback(() => {
    setQuery('');
    setState({
      results: [],
      isLoading: false,
      error: null,
      total: 0,
      fromCache: false,
      searchTime: 0
    });
  }, []);

  const retry = useCallback(async () => {
    if (query) {
      await performSearch(query);
    }
  }, [query, performSearch]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    results: state.results,
    isLoading: state.isLoading,
    error: state.error,
    total: state.total,
    fromCache: state.fromCache,
    searchTime: state.searchTime,
    search,
    clearResults,
    retry,
    query,
    setQuery
  };
}

/**
 * Hook pour la recherche par QR Code (utilisé par le scanner)
 */
export function useOfflineQRSearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const findByQRCode = useCallback(async (
    qrCode: string,
    entityType?: 'item' | 'container' | 'category'
  ): Promise<{
    found: boolean;
    type?: 'item' | 'container' | 'category';
    data?: any;
    fromCache: boolean;
  }> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await offlineSearchService.findByQRCode(qrCode, entityType);
      return result;
    } catch (error: any) {
      setError(error.message || 'Erreur lors de la recherche par QR Code');
      return {
        found: false,
        fromCache: true
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    findByQRCode,
    isLoading,
    error,
    clearError: () => setError(null)
  };
}

/**
 * Hook pour la recherche de catégories
 */
export function useOfflineCategorySearch(
  initialQuery: string = '',
  options: UseOfflineSearchOptions = {}
): UseOfflineSearchReturn<any> {
  const {
    debounceMs = 300,
    minQueryLength = 2,
    autoSearch = true,
    limit = 50
  } = options;

  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<SearchState<any>>({
    results: [],
    isLoading: false,
    error: null,
    total: 0,
    fromCache: false,
    searchTime: 0
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (searchQuery.length < minQueryLength) {
      // Pour les catégories, charger toutes si query vide
      abortControllerRef.current = new AbortController();
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const result = await offlineSearchService.searchCategories('', { limit });
        setState({
          results: result.items,
          total: result.total,
          fromCache: result.fromCache,
          searchTime: result.searchTime,
          isLoading: false,
          error: null
        });
      } catch (error: any) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error.message || 'Erreur lors du chargement des catégories'
        }));
      }
      return;
    }

    abortControllerRef.current = new AbortController();
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await offlineSearchService.searchCategories(searchQuery, { limit });

      setState({
        results: result.items,
        total: result.total,
        fromCache: result.fromCache,
        searchTime: result.searchTime,
        isLoading: false,
        error: null
      });

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error.message || 'Erreur lors de la recherche'
        }));
      }
    }
  }, [minQueryLength, limit]);

  const debouncedSearch = useDebouncedCallback(performSearch, debounceMs);

  const search = useCallback(async (searchQuery: string) => {
    setQuery(searchQuery);
    await performSearch(searchQuery);
  }, [performSearch]);

  useEffect(() => {
    if (autoSearch) {
      debouncedSearch(query);
    }
  }, [query, debouncedSearch, autoSearch]);

  // Charger toutes les catégories au démarrage
  useEffect(() => {
    if (autoSearch && !query) {
      performSearch('');
    }
  }, [autoSearch, query, performSearch]);

  const clearResults = useCallback(() => {
    setQuery('');
    setState({
      results: [],
      isLoading: false,
      error: null,
      total: 0,
      fromCache: false,
      searchTime: 0
    });
  }, []);

  const retry = useCallback(async () => {
    await performSearch(query);
  }, [query, performSearch]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    results: state.results,
    isLoading: state.isLoading,
    error: state.error,
    total: state.total,
    fromCache: state.fromCache,
    searchTime: state.searchTime,
    search,
    clearResults,
    retry,
    query,
    setQuery
  };
}