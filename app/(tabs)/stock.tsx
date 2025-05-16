import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, Platform, ActivityIndicator, TextInput, FlatList, ScrollView, TouchableOpacity, Switch, Modal, TextStyle, ViewStyle } from 'react-native';
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
// Remplacer react-native-modal-datetime-picker par Modal de react-native
// import DateTimePickerModal from "react-native-modal-datetime-picker";

// Importer le nouveau date picker compatible web
// Importer également useDefaultStyles et DateType si nécessaire pour les types
import DateTimePicker, { useDefaultStyles, DateType } from 'react-native-ui-datepicker';
import dayjs from 'dayjs'; // react-native-ui-datepicker utilise dayjs en interne

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
  
  // *** ÉTATS POUR LE MODAL DE DATE DE VENTE ***
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [itemToMarkSold, setItemToMarkSold] = useState<Item | null>(null);
  // Stocker la date comme un objet Date, initialisé à la date actuelle
  const [selectedSoldDate, setSelectedSoldDate] = useState<Date>(new Date());
  // État pour le prix de vente modifiable dans le modal
  const [editableSalePrice, setEditableSalePrice] = useState<string>("");
  // ******************************************

  // Récupérer les styles par défaut du date picker
  const defaultPickerStyles = useDefaultStyles();

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

  // Utiliser le hook d'actions du stock
  const { handleMarkAsSold, handleMarkAsAvailable } = useStockActions();

  // Mettre en place les callbacks stables en utilisant useRef
  // Initialiser la ref avec les fonctions externes et les setters internes
  const stableCallbacks = useRef({
    // Ajouter une référence à l'item à marquer comme vendu pour éviter les pertes d'état
    currentItemToMarkSold: null as Item | null,
    handleItemPress: (item: Item) => {
      setSelectedItem(item);
    },
    handleEditSuccess: () => {
      setSelectedItem(null);
      // Utiliser la ref pour accéder à refreshAlgolia
      stableCallbacks.current.refreshAlgolia();
    },
    handleEditCancel: () => {
      setSelectedItem(null);
    },
    handleLoadMore: () => {
      console.log(`[Stock] Load more triggered. Current count: ${itemsFromAlgolia.length}/${nbHits}`);
      // Utiliser la ref pour accéder à loadMore
      stableCallbacks.current.loadMore();
    },
    // Logique pour afficher le date picker avant de marquer comme vendu
    handleMarkAsSoldPress: (item: Item) => {
        console.log('[handleMarkAsSoldPress] Received item:', item);
        // Stocker l'item directement dans la référence stable
        stableCallbacks.current.currentItemToMarkSold = item;
        setItemToMarkSold(item); // Conserver pour la compatibilité
        // Initialiser la date du modal avec la date actuelle à l'ouverture
        setSelectedSoldDate(new Date());
        // Pré-remplir le prix de vente avec le prix actuel de l'article
        setEditableSalePrice(item.sellingPrice?.toString() || "");
        setDatePickerVisibility(true);
    },
    // Appeler directement handleMarkAsAvailable car pas besoin de date
    handleMarkAsAvailablePress: async (item: Item) => {
        // Utiliser la ref pour accéder à handleMarkAsAvailable
        await stableCallbacks.current.handleMarkAsAvailable(item.id.toString());
        // Utiliser la ref pour accéder à refreshAlgolia
        stableCallbacks.current.refreshAlgolia();
    },
    // Logique appelée quand une date est confirmée dans le date picker
    // Cette fonction sera appelée par le bouton OK du modal personnalisé
    handleDateConfirm: async () => {
        // Utiliser l'item stocké dans la référence stable plutôt que l'état React
        const itemToProcess = stableCallbacks.current.currentItemToMarkSold;
        console.log('[handleDateConfirm] Called with stableItemToMarkSold:', itemToProcess, 'selectedSoldDate:', selectedSoldDate);
        
        // Utiliser la date stockée dans l'état selectedSoldDate
        if (itemToProcess && selectedSoldDate) {
            const finalSalePrice = parseFloat(editableSalePrice);
            const salePrice = isNaN(finalSalePrice) ? undefined : finalSalePrice;
            console.log('[handleDateConfirm] Calling handleMarkAsSold with:', {
                itemId: itemToProcess.id.toString(),
                soldDate: selectedSoldDate.toISOString(),
                salePrice: salePrice
            });
            
            try {
                // Attendre que la mise à jour soit terminée
                const updateResult = await stableCallbacks.current.handleMarkAsSold(
                    itemToProcess.id.toString(),
                    selectedSoldDate.toISOString(),
                    salePrice
                );
                
                console.log('[handleDateConfirm] handleMarkAsSold result:', updateResult);
                
                // Si la mise à jour a réussi, vérifier l'état directement via la base de données
                if (updateResult) {
                    try {
                        // Attendre un peu pour que la base de données se mette à jour complètement
                        await new Promise(resolve => setTimeout(resolve, 500));
                        const updatedItem = await database.getItem(itemToProcess.id);
                        console.log('[handleDateConfirm] Updated item check:', updatedItem);
                        
                        if (updatedItem && updatedItem.status === 'sold') {
                            console.log('[handleDateConfirm] Item status successfully changed to sold!');
                        } else {
                            console.warn('[handleDateConfirm] Item status check failed or not updated yet');
                        }
                    } catch (checkError) {
                        console.error('[handleDateConfirm] Error checking updated item:', checkError);
                    }
                }
                
                console.log('[handleDateConfirm] Now refreshing data');
                // Attendre aussi la fin du rafraîchissement
                await stableCallbacks.current.refreshAlgolia();
                console.log('[handleDateConfirm] refreshAlgolia completed');
                
                setItemToMarkSold(null); // Réinitialiser l'article
                stableCallbacks.current.currentItemToMarkSold = null; // Réinitialiser aussi dans la référence stable
                setEditableSalePrice(""); // Réinitialiser le prix modifiable
            } catch (error) {
                console.error('[handleDateConfirm] Error during update:', error);
            }
        } else {
            console.error('[handleDateConfirm] Cannot proceed: itemToProcess or selectedSoldDate is null', 
                { itemToProcess, selectedSoldDate });
        }
        setDatePickerVisibility(false); // Fermer le modal après confirmation
    },
    // Logique appelée quand l'utilisateur annule le date picker
    handleDateCancel: () => {
        setDatePickerVisibility(false);
        setItemToMarkSold(null); // Annuler la sélection de l'article
        stableCallbacks.current.currentItemToMarkSold = null; // Réinitialiser aussi dans la référence stable
        setEditableSalePrice(""); // Aussi réinitialiser le prix ici
    },
    // Fonctions externes qui seront mises à jour par useEffect
    handleMarkAsSold: async (itemId: string, soldDate: string, newSellingPrice?: number): Promise<boolean | undefined> => { 
        // Cette fonction est une placeholder, la vraie est dans useStockActions
        // et sera assignée via useEffect. Le typage ici aide TypeScript.
        console.log('Placeholder handleMarkAsSold called', itemId, soldDate, newSellingPrice);
        return undefined;
    },
    handleMarkAsAvailable: handleMarkAsAvailable,
    loadMore: loadMore,
    refreshAlgolia: refreshAlgolia,

  });

  // Mettre à jour les références stables SEULEMENT quand les fonctions externes changent
  useEffect(() => {
    stableCallbacks.current.handleMarkAsSold = handleMarkAsSold;
    stableCallbacks.current.handleMarkAsAvailable = handleMarkAsAvailable;
    stableCallbacks.current.loadMore = loadMore;
    stableCallbacks.current.refreshAlgolia = refreshAlgolia;
    // Ajouter les dépendances nécessaires
  }, [handleMarkAsSold, handleMarkAsAvailable, loadMore, refreshAlgolia]);

  // Rafraîchir les données quand on revient sur cet écran
  useFocusEffect(
    useCallback(() => {
      console.log('[Stock] Screen focused, refreshing data');
      // Utiliser la ref pour accéder à refreshAlgolia
      stableCallbacks.current.refreshAlgolia();
      return () => {
        console.log('[Stock] Screen unfocused');
      };
    }, []) // Le tableau de dépendances est vide car on utilise la ref
  );


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
  
  // Les actions sont maintenant dans les dépendances de la ref stableCallbacks
  // const { handleMarkAsSold, handleMarkAsAvailable } = useStockActions();
  
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
      <AlgoliaSearchBox/>
      <TouchableOpacity style={styles.filtersToggleHeader} onPress={() => setShowFilters(!showFilters)}>
        <Text style={styles.filtersToggleHeaderText}>Filtrer les articles</Text>
      </TouchableOpacity>
      {showFilters && (
        <View style={styles.filtersContainer}>
          <RefinementListFilter attribute="category_name" title="Catégorie"/>
          <RefinementListFilter attribute="container_reference" title="Container"/>
          <RefinementListFilter attribute="status" title="Disponibilité"/>
        </View>
      )}
      {!isAlgoliaLoading && itemsFromAlgolia.length === 0 && (
         <View style={styles.noResultsContainer}>
           <Text style={styles.noResultsText}>Aucun article trouvé.</Text>
         </View>
       )}
        <MemoizedItemList
          items={itemsFromAlgolia}
          onItemPress={stableCallbacks.current.handleItemPress}
          onMarkAsSold={stableCallbacks.current.handleMarkAsSoldPress}
          onMarkAsAvailable={stableCallbacks.current.handleMarkAsAvailablePress}
          categories={categoriesData || []}
          containers={containersData || []}
          selectedItem={selectedItem}
          onEditSuccess={stableCallbacks.current.handleEditSuccess}
          onEditCancel={stableCallbacks.current.handleEditCancel}
          onEndReached={stableCallbacks.current.handleLoadMore}
          isLoadingMore={isAlgoliaLoading && itemsFromAlgolia.length > 0}
        />

        {/* *** MODAL POUR LA SÉLECTION DE LA DATE DE VENTE (Personnalisé avec sélecteur visuel) *** */}
        <Modal
            visible={isDatePickerVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={stableCallbacks.current.handleDateCancel}>
            <View style={styles.datePickerModalContainer}>
                <View style={styles.datePickerModalContent}>
                    <Text style={styles.datePickerModalTitle}>Sélectionner la date et le prix de vente</Text>
                    <DateTimePicker
                        mode="single"
                        date={selectedSoldDate}
                        onChange={({ date }) => {
                            setSelectedSoldDate(date instanceof Date ? date : new Date());
                        }}
                         styles={{
                            ...defaultPickerStyles,
                            selected_label: {
                                ...(defaultPickerStyles.selected_label as TextStyle), 
                                color: '#FFFFFF',
                            },
                            selected: {
                                ...(defaultPickerStyles.selected as ViewStyle),
                                backgroundColor: '#007AFF',
                            },
                            today: {
                                ...(defaultPickerStyles.today as ViewStyle),
                                borderColor: '#007AFF', 
                                borderWidth: 1,
                            },
                            day_label: { 
                                ...(defaultPickerStyles.day_label as TextStyle),
                                color: '#000000',
                            },
                            disabled_label: { 
                                ...(defaultPickerStyles.disabled_label as TextStyle),
                                color: '#aaaaaa',
                            },
                            month_label: { 
                                ...(defaultPickerStyles.month_label as TextStyle),
                                color: '#000000',
                                fontWeight: 'bold',
                            },
                            year_label: { 
                                ...(defaultPickerStyles.year_label as TextStyle),
                                color: '#000000',
                                fontWeight: 'bold',
                            },
                         }}
                         locale="fr"
                    />
                    <Text style={styles.salePriceInputLabel}>Prix de vente (€) :</Text>
                    <TextInput
                        style={styles.salePriceInput}
                        value={editableSalePrice}
                        onChangeText={setEditableSalePrice}
                        placeholder={itemToMarkSold?.sellingPrice?.toString() || "Prix de vente"}
                        keyboardType="numeric"
                        placeholderTextColor="#999"
                    />
                    <View style={styles.datePickerButtonsContainer}>
                        <TouchableOpacity 
                            style={[styles.datePickerButton, styles.datePickerCancelButton]}
                            onPress={stableCallbacks.current.handleDateCancel}>
                            <Text style={styles.datePickerButtonText}>Annuler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                             style={[styles.datePickerButton, styles.datePickerConfirmButton]}
                            onPress={stableCallbacks.current.handleDateConfirm}>
                            <Text style={[styles.datePickerButtonText, styles.datePickerConfirmButtonText]}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
        {/* ******************************************************************* */}
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
            filters: 'doc_type:item'
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
  // *** STYLES POUR LE MODAL DE DATE PERSONNALISÉ ***
  datePickerModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Fond semi-transparent
  },
  datePickerModalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: 300, // Largeur fixe ou adaptable
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  datePickerModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  salePriceInputLabel: {
    marginTop: 15,
    marginBottom: 5,
    fontSize: 16,
    color: '#333',
    alignSelf: 'flex-start', // Aligner à gauche
  },
  salePriceInput: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 15,
    width: '100%', // Prendre toute la largeur du modal content
    backgroundColor: '#fff',
    fontSize: 16,
  },
  datePickerButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  datePickerButton: {
    padding: 10,
    borderRadius: 5,
    minWidth: 100,
    alignItems: 'center',
  },
  datePickerCancelButton: {
    // Pas de couleur de fond par défaut, texte bleu
  },
  datePickerConfirmButton: {
    backgroundColor: '#007AFF',
  },
  datePickerButtonText: {
    fontSize: 16,
    color: '#007AFF', // Couleur bleue pour Annuler
  },
  datePickerConfirmButtonText: {
    color: '#fff', // Couleur blanche pour OK
    fontWeight: 'bold',
  },
  // **************************************************
});

// La MemoizedFilterBar originale et ses dépendances (comme StockFilters et les callbacks de filtre)
// ont été enlevées ou commentées car Algolia gère maintenant la recherche principale.
// Il faudra réintégrer les filtres (catégorie, statut, etc.) en utilisant les widgets/hooks d'Algolia.
// Par exemple, useRefinementList pour les catégories/status, useRangeInput pour les prix.
