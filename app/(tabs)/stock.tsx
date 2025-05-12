import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, Platform, ActivityIndicator, TextInput, FlatList } from 'react-native';
import ItemList from '../../src/components/ItemList';
// import { FilterBar } from '../../src/components/FilterBar'; // Temporarily remove or replace
import { useDispatch } from 'react-redux';
import { useStockActions } from '../../src/hooks/useStockActions';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import type { Item } from '../../src/types/item';
import type { Container } from '../../src/types/container';
import type { Category } from '../../src/types/category';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { database } from '../../src/database/database';
import { setCategories } from '../../src/store/categorySlice';
import { setContainers } from '../../src/store/containersSlice';
import * as Sentry from '@sentry/react-native';
import { useRefreshStore } from '../../src/store/refreshStore';

// Algolia imports
import { InstantSearch, Configure } from 'react-instantsearch-hooks-web';
import { searchClient, INDEX_NAME } from '../../src/config/algolia';
import { useAlgoliaSearch } from '../../src/hooks/useAlgoliaSearch';
import { useFocusEffect } from '@react-navigation/native';

// Interface pour les filtres de stock - maintenu pour référence future
interface StockFilters {
  categoryId?: number;
  containerId?: number | 'none';
  status?: 'all' | 'available' | 'sold';
  minPrice?: number;
  maxPrice?: number;
}

interface StockData {
  categories: Category[];
  containers: Container[];
}

const QUERY_KEYS = {
  allData: 'allData',
  categoriesOnly: 'categoriesOnly',
  containersOnly: 'containersOnly',
} as const;

const CACHE_CONFIG = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 30 * 60 * 1000, // 30 minutes
  retry: 3,
} as const;

type QueryError = Error;

// Composant de recherche simple pour Algolia
const AlgoliaSearchBox = () => {
  const { query, search } = useAlgoliaSearch();
  const [inputValue, setInputValue] = useState(query || '');
  
  const onChangeText = (newQuery: string) => {
    setInputValue(newQuery);
    search(newQuery);
  };
  
  // Synchroniser l'input avec la query actuelle
  useEffect(() => {
    if (query !== inputValue) {
      setInputValue(query);
    }
  }, [query]);

  return (
    <View style={styles.searchBoxContainer}>
      <TextInput
        style={styles.searchBoxInput}
        value={inputValue}
        onChangeText={onChangeText}
        placeholder="Rechercher des articles..."
        placeholderTextColor="#999"
        clearButtonMode="always"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
};

// Helper debounce function n'est plus nécessaire, il est dans useAlgoliaSearch

const MemoizedItemList = React.memo(ItemList);

const StockScreenContent = () => {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const refreshTimestamp = useRefreshStore(state => state.refreshTimestamp);
  
  // Utiliser notre hook personnalisé
  const { 
    items: itemsFromAlgolia, 
    isLoading: isAlgoliaLoading,
    status: algoliaStatus,
    isLastPage,
    loadMore,
    refresh: refreshAlgolia,
    nbHits,
    currentPage
  } = useAlgoliaSearch();

  // Pour le débogage, surveiller les changements d'items
  useEffect(() => {
    console.log(`[Stock] Items count: ${itemsFromAlgolia.length}/${nbHits}, isLastPage: ${isLastPage}, status: ${algoliaStatus}, currentPage: ${currentPage}`);
  }, [itemsFromAlgolia.length, nbHits, isLastPage, algoliaStatus, currentPage]);

  // Rafraîchir les données quand on revient sur cet écran
  useFocusEffect(
    useCallback(() => {
      console.log('[Stock] Screen focused, refreshing data');
      refreshAlgolia();
      return () => {
        console.log('[Stock] Screen unfocused');
      };
    }, [refreshAlgolia])
  );

  const stableCallbacks = useRef({
    handleItemPress: (item: Item) => {
      setSelectedItem(item);
    },
    handleEditSuccess: () => {
      setSelectedItem(null);
      refreshAlgolia();
    },
    handleEditCancel: () => {
      setSelectedItem(null);
    },
    handleLoadMore: () => {
      console.log(`[Stock] Load more triggered. Current count: ${itemsFromAlgolia.length}/${nbHits}`);
      loadMore();
    }
  }).current;

  // Mettre à jour les références stables quand les dépendances changent
  useEffect(() => {
    stableCallbacks.handleLoadMore = () => {
      console.log(`[Stock] Load more triggered. Current count: ${itemsFromAlgolia.length}/${nbHits}`);
      loadMore();
    };
  }, [loadMore, itemsFromAlgolia.length, nbHits]);

  const { 
    data: categoriesData, 
    isLoading: isLoadingCategories, 
    error: errorCategories 
  } = useQuery<Category[], QueryError>({
    queryKey: [QUERY_KEYS.categoriesOnly, refreshTimestamp],
    queryFn: async () => {
      try {
        const data = await database.getCategories();
        if (data && data.length > 0) {
          dispatch(setCategories(data));
        }
        return data || [];
      } catch (error) {
        Sentry.captureException(error, { tags: { type: 'categories_fetch_error' } });
        throw new Error('Erreur lors de la récupération des catégories');
      }
    },
    ...CACHE_CONFIG
  });

  const { 
    data: containersData, 
    isLoading: isLoadingContainers, 
    error: errorContainers 
  } = useQuery<Container[], QueryError>({
    queryKey: [QUERY_KEYS.containersOnly, refreshTimestamp],
    queryFn: async () => {
      try {
        const data = await database.getContainers();
        if (data && data.length > 0) {
          dispatch(setContainers(data));
        }
        return data || [];
      } catch (error) {
        Sentry.captureException(error, { tags: { type: 'containers_fetch_error' } });
        throw new Error('Erreur lors de la récupération des containers');
      }
    },
    ...CACHE_CONFIG
  });
  
  const { handleMarkAsSold, handleMarkAsAvailable } = useStockActions();
  
  const isLoading = isLoadingCategories || isLoadingContainers || isAlgoliaLoading;

  if (isLoading && itemsFromAlgolia.length === 0) {
    return (
      <ErrorBoundary>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Chargement des articles...</Text>
        </View>
      </ErrorBoundary>
    );
  }

  if (errorCategories || errorContainers) {
    return (
      <ErrorBoundary>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Une erreur est survenue lors du chargement des données de filtre.
            {errorCategories?.message} {errorContainers?.message}
          </Text>
        </View>
      </ErrorBoundary>
    );
  }

  return (
      <View style={styles.container}>
      <AlgoliaSearchBox />
      
      {!isAlgoliaLoading && itemsFromAlgolia.length === 0 && (
         <View style={styles.noResultsContainer}>
           <Text style={styles.noResultsText}>Aucun article trouvé.</Text>
         </View>
       )}
        
        <MemoizedItemList
          items={itemsFromAlgolia}
          onItemPress={stableCallbacks.handleItemPress}
          onMarkAsSold={async (itemId) => {
            await handleMarkAsSold(itemId);
            refreshAlgolia();
          }}
          onMarkAsAvailable={async (itemId) => {
            await handleMarkAsAvailable(itemId);
            refreshAlgolia();
          }}
          categories={categoriesData || []}
          containers={containersData || []}
          selectedItem={selectedItem}
          onEditSuccess={stableCallbacks.handleEditSuccess}
          onEditCancel={stableCallbacks.handleEditCancel}
          onEndReached={stableCallbacks.handleLoadMore}
          isLoadingMore={isAlgoliaLoading && itemsFromAlgolia.length > 0}
        />
      </View>
  );
}


export default function StockScreen() {
  return (
    <ErrorBoundary>
      <InstantSearch searchClient={searchClient} indexName={INDEX_NAME}>
        <Configure 
          {...{ 
            hitsPerPage: 20, 
            // Permettre de charger jusqu'à 500 résultats par requête
            distinct: true,
            analytics: false,
            // Assurer que tous les attributs sont retournés
            attributesToRetrieve: ['*']
          } as any}
        />
        <StockScreenContent />
      </InstantSearch>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingBottom: Platform.OS === 'ios' ? 85 : 65,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#007AFF',
    marginTop: 12,
    textAlign: 'center',
  },
  searchBoxContainer: {
    padding: Platform.OS === 'web' ? 12 : 8,
    backgroundColor: Platform.OS === 'web' ? '#fff' : '#f5f5f5',
    borderBottomWidth: Platform.OS === 'web' ? 1 : 0,
    borderBottomColor: Platform.OS === 'web' ? '#eee' : 'transparent',
  },
  searchBoxInput: {
    backgroundColor: '#fff',
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
  },
});

// La MemoizedFilterBar originale et ses dépendances (comme StockFilters et les callbacks de filtre)
// ont été enlevées ou commentées car Algolia gère maintenant la recherche principale.
// Il faudra réintégrer les filtres (catégorie, statut, etc.) en utilisant les widgets/hooks d'Algolia.
// Par exemple, useRefinementList pour les catégories/status, useRangeInput pour les prix.
