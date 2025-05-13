import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, Platform, ActivityIndicator, TextInput, FlatList, ScrollView, TouchableOpacity, Switch } from 'react-native';
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
import { InstantSearch, Configure, useRefinementList, useToggleRefinement } from 'react-instantsearch-hooks-web';
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

// *** NOUVEAUX COMPOSANTS DE FILTRE ***

// Composant générique pour les filtres de liste (Catégories, Containers, Statut)
const RefinementListFilter = ({ attribute, title }: { attribute: string; title: string }) => {
  const { items, refine, canRefine } = useRefinementList({ attribute });

  // *** AJOUT DE LOGS POUR DIAGNOSTIC ***
  useEffect(() => {
    console.log(`[RefinementListFilter] ${title} - canRefine: ${canRefine}, items:`, items);
  }, [canRefine, items, title]);
  // ***********************************

  if (!canRefine) {
    return null; // Ne rien afficher si aucun raffinement possible
  }

  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterOptionsContainer}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.value}
            style={[styles.filterButton, item.isRefined && styles.filterButtonActive]}
            onPress={() => refine(item.value)}
          >
            <Text style={[styles.filterButtonText, item.isRefined && styles.filterButtonTextActive]}>
              {item.label} ({item.count})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

// Composant pour le filtre booléen (Prix Achat = Prix Vente)
const PriceMatchFilter = ({ attribute, title }: { attribute: string; title: string }) => {
  const { value, refine, canRefine } = useToggleRefinement({ attribute, on: true }); // on: true signifie que le filtre est actif quand la valeur est true

  if (!canRefine) {
    return null;
  }

  return (
    <View style={[styles.filterSection, styles.toggleFilterContainer]}>
      <Text style={styles.filterTitle}>{title}</Text>
      <Switch
        value={value.isRefined}
        onValueChange={() => refine({ isRefined: !value.isRefined })}
        trackColor={{ false: "#767577", true: "#81b0ff" }}
        thumbColor={value.isRefined ? "#007AFF" : "#f4f3f4"}
        ios_backgroundColor="#3e3e3e"
      />
    </View>
  );
};

const MemoizedItemList = React.memo(ItemList);

const StockScreenContent = () => {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showFilters, setShowFilters] = useState(false);
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

      {/* *** SECTION FILTRES *** */}
      <TouchableOpacity style={styles.filtersToggleHeader} onPress={() => setShowFilters(!showFilters)}>
        <Text style={styles.filtersToggleHeaderText}>Filtrer les articles</Text>
      </TouchableOpacity>
      {showFilters && (
        <View style={styles.filtersContainer}>
          <RefinementListFilter attribute="category_name" title="Catégorie" />
          <RefinementListFilter attribute="container_reference" title="Container" />
          <RefinementListFilter attribute="status" title="Disponibilité" />
        </View>
      )}
      {/* ********************** */}

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
            distinct: true,
            analytics: false,
            attributesToRetrieve: ['*'],
            // *** AJOUT DES FACETTES POUR LES FILTRES ***
            // Assurez-vous que ces attributs sont configurés comme 'attributesForFaceting'
            // dans votre dashboard Algolia (section Configuration > Facets)
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
  // *** NOUVEAUX STYLES POUR LES FILTRES ***
  filtersContainer: {
    paddingVertical: 8,
    paddingHorizontal: Platform.OS === 'web' ? 12 : 8,
    backgroundColor: Platform.OS === 'web' ? '#fff' : '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterSection: {
    marginBottom: 8,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  filterOptionsContainer: {
    paddingVertical: 4,
  },
  filterButton: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#005ecb',
  },
  filterButtonText: {
    fontSize: 13,
    color: '#333',
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  toggleFilterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 8, // Un peu d'espace pour le switch
  },
  // **************************************
  filtersToggleHeader: {
    padding: Platform.OS === 'web' ? 12 : 8,
    backgroundColor: Platform.OS === 'web' ? '#fff' : '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filtersToggleHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});

// La MemoizedFilterBar originale et ses dépendances (comme StockFilters et les callbacks de filtre)
// ont été enlevées ou commentées car Algolia gère maintenant la recherche principale.
// Il faudra réintégrer les filtres (catégorie, statut, etc.) en utilisant les widgets/hooks d'Algolia.
// Par exemple, useRefinementList pour les catégories/status, useRangeInput pour les prix.
