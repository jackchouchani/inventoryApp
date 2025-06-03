import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, ActivityIndicator, TextInput, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useAppTheme } from '../../src/contexts/ThemeContext';
import { useStockActions } from '../../src/hooks/useStockActions';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import type { Item } from '../../src/types/item';

// Hooks Redux optimisés - utilisation des hooks existants pour le chargement initial
import { useItems } from '../../src/hooks/useItems';
import { useCategories } from '../../src/hooks/useCategories';
import { useContainers } from '../../src/hooks/useContainers';

// Hooks optimisés pour Redux avec sélecteurs mémoïsés
import { useFilteredItems, useGlobalSearch } from '../../src/hooks/useOptimizedSelectors';
import { ItemFilters } from '../../src/store/selectors';

// Composants optimisés
import VirtualizedItemList from '../../src/components/VirtualizedItemList';
import StyleFactory from '../../src/styles/StyleFactory';

import DateTimePicker from 'react-native-ui-datepicker';

// Interface pour les filtres de stock
interface StockFilters {
  categoryName?: string;
  containerName?: string;
  status?: 'all' | 'available' | 'sold';
  minPrice?: number;
  maxPrice?: number;
}

// Ajout de l'interface pour les props de SearchBox
interface SearchBoxProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

// --- Créer un nouveau composant pour l'input du prix et les boutons du modal ---
const SellingPriceInputModal: React.FC<{
    initialPrice: string;
    onConfirm: (price: string) => void; // Accepte la saisie comme string
    onCancel: () => void;
}> = ({ initialPrice, onConfirm, onCancel }) => {
    const { activeTheme } = useAppTheme();
    const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemForm');
    const [localEditableSalePrice, setLocalEditableSalePrice] = useState(initialPrice);

    // Met à jour l'état local si le prix initial change (quand le modal s'ouvre pour un nouvel item)
    useEffect(() => {
        setLocalEditableSalePrice(initialPrice);
    }, [initialPrice]);

    const handleLocalPriceChange = useCallback((text: string) => {
        const cleanText = text.replace(',', '.');
        if (cleanText === '' || /^\d*\.?\d*$/.test(cleanText)) {
            setLocalEditableSalePrice(cleanText);
        }
    }, []);

    return (
        <>
            <TextInput
                style={styles.input}
                value={localEditableSalePrice}
                onChangeText={handleLocalPriceChange}
                placeholder="Prix de vente"
                keyboardType="numeric"
                placeholderTextColor={activeTheme.text.secondary}
            />
            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={styles.buttonSecondary}
                    onPress={onCancel}>
                    <Text style={styles.buttonTextSecondary}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.button}
                    onPress={() => onConfirm(localEditableSalePrice)}>
                    <Text style={styles.buttonText}>OK</Text>
                </TouchableOpacity>
            </View>
        </>
    );
};

// --- Nouvelle SearchBox optimisée ---
const SearchBox: React.FC<SearchBoxProps> = ({ searchQuery, setSearchQuery }) => {
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'FilterBar');
  
  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.filterButton, { flex: 1, marginRight: 0 }]}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Rechercher des articles..."
        placeholderTextColor={activeTheme.text.secondary}
        clearButtonMode="always"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
};

const StockScreenContent = () => {
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemList');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // --- STATES OPTIMISÉS ---
  const [filters, setFilters] = useState<StockFilters>({ status: 'available' });
  const [searchQuery, setSearchQuery] = useState('');

  // *** ÉTATS POUR LE MODAL DE DATE DE VENTE ***
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [itemToMarkSold, setItemToMarkSold] = useState<Item | null>(null);
  const [selectedSoldDate, setSelectedSoldDate] = useState<Date>(new Date());

  // --- Chargement des données avec hooks Redux appropriés ---
  const { data: items, isLoading: itemsLoading, error: itemsError, loadMore } = useItems();
  const { categories, isLoading: categoriesLoading, error: categoriesError } = useCategories();  
  const { data: containers, isLoading: containersLoading, error: containersError } = useContainers();

  // --- Conversion des filtres StockFilters vers ItemFilters ---
  const reduxFilters: ItemFilters = useMemo(() => {
    const computedFilters = {
      status: filters.status === 'all' ? undefined : filters.status, // Ne pas filtrer si "all"
      searchQuery: searchQuery.trim(),
      // Ajouter mapping catégorie par nom vers ID si nécessaire
      categoryId: filters.categoryName ? 
        categories.find(cat => cat.name === filters.categoryName)?.id : undefined,
      containerId: filters.containerName ?
        containers.find(cont => cont.name === filters.containerName)?.id : undefined,
    };
    console.log('[StockScreen] Computed filters:', computedFilters, 'from UI filters:', filters);
    return computedFilters;
  }, [filters, searchQuery, categories, containers]);

  // --- Utilisation intelligente des hooks selon le contexte ---
  const isSearchActive = searchQuery.trim().length > 0;
  
  // Si recherche active, utiliser useGlobalSearch pour charger tous les items
  const { items: searchResults, isSearching } = useGlobalSearch(isSearchActive ? searchQuery : '');
  
  // Sinon, utiliser le filtrage standard
  const standardResults = useFilteredItems(isSearchActive ? {} : reduxFilters);
  
  // Résultats finaux selon le mode
  const filteredItems = useMemo(() => {
    if (isSearchActive) {
      // En mode recherche, appliquer les autres filtres sur les résultats de recherche
      let results = searchResults;
      
      if (reduxFilters.status) {
        results = results.filter(item => item.status === reduxFilters.status);
      }
      if (reduxFilters.categoryId) {
        results = results.filter(item => item.categoryId === reduxFilters.categoryId);
      }
      if (reduxFilters.containerId) {
        results = results.filter(item => item.containerId === reduxFilters.containerId);
      }
      
      return results;
    } else {
      return standardResults;
    }
  }, [isSearchActive, searchResults, standardResults, reduxFilters]);

  // Combiner les états de chargement et erreurs
  const isLoading = (itemsLoading || categoriesLoading || containersLoading || isSearching);
  const error = itemsError || categoriesError || containersError;

  console.log('[StockScreen] Hook data:', { 
    itemsCount: items?.length || 0, 
    filteredCount: filteredItems.length,
    categoriesCount: categories.length, 
    containersCount: containers?.length || 0, 
    isSearchActive,
    isSearching,
    isLoading, 
    error,
    filters: reduxFilters 
  });

  // Utiliser le hook d'actions du stock
  const { handleMarkAsSold, handleMarkAsAvailable } = useStockActions();

  // Mettre en place les callbacks stables en utilisant useRef
  const stableCallbacks = useRef({
    currentItemToMarkSold: null as Item | null,
    handleItemPress: (item: Item) => {
      setSelectedItem(item);
    },
    handleEditSuccess: () => {
      setSelectedItem(null);
    },
    handleEditCancel: () => {
      setSelectedItem(null);
    },
    handleMarkAsSoldPress: (item: Item) => {
        console.log('[handleMarkAsSoldPress] Received item:', item);
        stableCallbacks.current.currentItemToMarkSold = item;
        setItemToMarkSold(item);
        setSelectedSoldDate(new Date());
        setDatePickerVisibility(true);
    },
    handleMarkAsAvailablePress: async (item: Item) => {
        await handleMarkAsAvailable(item.id.toString());
    },
    handleDateConfirm: async (saisiePrixVente: string) => {
        const itemToProcess = stableCallbacks.current.currentItemToMarkSold;
        console.log('[handleDateConfirm] Called with stableItemToMarkSold:', itemToProcess, 'selectedSoldDate:', selectedSoldDate, 'saisiePrixVente:', saisiePrixVente);

        if (itemToProcess && selectedSoldDate) {
            const cleanText = saisiePrixVente.replace(',', '.');
            console.log('[DEBUG StockScreen] Valeur cleanText APRES nettoyage:', cleanText, 'Type:', typeof cleanText);

            const parsedSalePrice = parseFloat(cleanText);
            console.log('[DEBUG StockScreen] Valeur parsedSalePrice APRES parseFloat:', parsedSalePrice, 'Type:', typeof parsedSalePrice);

            const salePrice = isNaN(parsedSalePrice) ? 0 : parsedSalePrice;

            console.log('[DEBUG StockScreen] Valeur salePrice envoyée:', salePrice, typeof salePrice);
            console.log('[handleDateConfirm] Calling handleMarkAsSold with:', {
                itemId: itemToProcess.id.toString(),
                soldDate: selectedSoldDate.toISOString(),
                salePrice: salePrice
            });

            try {
                const updateResult = await handleMarkAsSold(
                    itemToProcess.id.toString(),
                    selectedSoldDate.toISOString(),
                    salePrice
                );

                console.log('[handleDateConfirm] handleMarkAsSold result:', updateResult);

                // Fermer le modal et nettoyer l'état APRÈS la mise à jour réussie
                setDatePickerVisibility(false);
                setItemToMarkSold(null);
                stableCallbacks.current.currentItemToMarkSold = null;
            } catch (error) {
                console.error('[handleDateConfirm] Error during update:', error);
                // En cas d'erreur, fermer quand même le modal
                setDatePickerVisibility(false);
                setItemToMarkSold(null);
                stableCallbacks.current.currentItemToMarkSold = null;
            }
        }
    },
    handleCancelDatePicker: () => {
        setDatePickerVisibility(false);
        setItemToMarkSold(null);
        stableCallbacks.current.currentItemToMarkSold = null;
    }
  });

  // Filtres mémoïsés pour éviter les re-renders - COMPACTS
  const CompactFilterBar = useCallback(() => {
    const filterStyles = StyleFactory.getThemedStyles(activeTheme, 'FilterBar');
    
    return (
      <View style={[filterStyles.container, { paddingVertical: 8, paddingHorizontal: 12 }]}>
        {/* Ligne 1: Statuts */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[
              { key: 'all', label: 'Tous' },
              { key: 'available', label: 'Disponibles' },
              { key: 'sold', label: 'Vendus' }
            ].map((status) => (
              <TouchableOpacity
                key={status.key}
                style={[
                  filterStyles.filterButton,
                  filters.status === status.key && filterStyles.filterButtonActive,
                  { paddingVertical: 4, paddingHorizontal: 8, marginRight: 0 }
                ]}
                onPress={() => {
                  setFilters(prev => ({
                    ...prev,
                    status: status.key as 'all' | 'available' | 'sold'
                  }));
                }}
              >
                <Text style={[
                  filterStyles.filterButtonText,
                  filters.status === status.key && filterStyles.filterButtonTextActive,
                  { fontSize: 11 }
                ]}>
                  {status.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Ligne 2: Catégories - TOUTES LES CATÉGORIES */}
        {categories.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                style={[
                  filterStyles.filterButton,
                  !filters.categoryName && filterStyles.filterButtonActive,
                  { paddingVertical: 4, paddingHorizontal: 8, marginRight: 0 }
                ]}
                onPress={() => setFilters(prev => ({ ...prev, categoryName: undefined }))}
              >
                <Text style={[
                  filterStyles.filterButtonText,
                  !filters.categoryName && filterStyles.filterButtonTextActive,
                  { fontSize: 11 }
                ]}>
                  Toutes catégories
                </Text>
              </TouchableOpacity>
              
              {/* Afficher TOUTES les catégories au lieu de .slice(0, 5) */}
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    filterStyles.filterButton,
                    filters.categoryName === category.name && filterStyles.filterButtonActive,
                    { paddingVertical: 4, paddingHorizontal: 8, marginRight: 0 }
                  ]}
                  onPress={() => {
                    setFilters(prev => ({
                      ...prev,
                      categoryName: prev.categoryName === category.name ? undefined : category.name
                    }));
                  }}
                >
                  <Text style={[
                    filterStyles.filterButtonText,
                    filters.categoryName === category.name && filterStyles.filterButtonTextActive,
                    { fontSize: 11 }
                  ]}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Ligne 3: Containers - TOUS LES CONTAINERS */}
        {containers && containers.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                style={[
                  filterStyles.filterButton,
                  !filters.containerName && filterStyles.filterButtonActive,
                  { paddingVertical: 4, paddingHorizontal: 8, marginRight: 0 }
                ]}
                onPress={() => setFilters(prev => ({ ...prev, containerName: undefined }))}
              >
                <Text style={[
                  filterStyles.filterButtonText,
                  !filters.containerName && filterStyles.filterButtonTextActive,
                  { fontSize: 11 }
                ]}>
                  Tous containers
                </Text>
              </TouchableOpacity>
              
              {/* Afficher TOUS les containers */}
              {containers.map((container) => (
                <TouchableOpacity
                  key={container.id}
                  style={[
                    filterStyles.filterButton,
                    filters.containerName === container.name && filterStyles.filterButtonActive,
                    { paddingVertical: 4, paddingHorizontal: 8, marginRight: 0 }
                  ]}
                  onPress={() => {
                    setFilters(prev => ({
                      ...prev,
                      containerName: prev.containerName === container.name ? undefined : container.name
                    }));
                  }}
                >
                  <Text style={[
                    filterStyles.filterButtonText,
                    filters.containerName === container.name && filterStyles.filterButtonTextActive,
                    { fontSize: 11 }
                  ]}>
                    {container.name}#{container.number}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    );
  }, [categories, containers, filters, activeTheme]);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Une erreur est survenue : {error}</Text>
      </View>
    );
  }

  if (isLoading && items?.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
        <Text style={[styles.emptyText, { marginTop: 12 }]}>Chargement des articles...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Barre de recherche optimisée */}
      <SearchBox searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      
      {/* Bouton Filtres compact */}
      <TouchableOpacity
        style={[
          styles.filterToggleButton,
          { 
            backgroundColor: activeTheme.surface,
            borderColor: activeTheme.border 
          }
        ]}
        onPress={() => setShowFilters(!showFilters)}
      >
        <Text style={[styles.filterToggleText, { color: activeTheme.text.primary }]}>
          {showFilters ? '🔼 Masquer filtres' : '🔽 Filtres'}
        </Text>
      </TouchableOpacity>

      {/* Filtres compacts */}
      {showFilters && <CompactFilterBar />}

      {/* Liste virtualisée optimisée */}
      <VirtualizedItemList
        items={filteredItems}
        categories={categories}
        containers={containers}
        isLoading={isLoading}
        onItemPress={stableCallbacks.current.handleItemPress}
        onMarkAsSold={stableCallbacks.current.handleMarkAsSoldPress}
        onMarkAsAvailable={stableCallbacks.current.handleMarkAsAvailablePress}
        onEndReached={loadMore}
        isLoadingMore={itemsLoading && items.length > 0}
        estimatedItemSize={120}
      />

      {/* Modal de sélection de date et prix optimisé */}
      <Modal
        visible={isDatePickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={stableCallbacks.current.handleCancelDatePicker}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: activeTheme.surface }]}>
            <Text style={[styles.modalTitle, { color: activeTheme.text.primary }]}>
              Marquer comme vendu
            </Text>
            
            <Text style={[styles.modalLabel, { color: activeTheme.text.primary }]}>Date de vente :</Text>
            <DateTimePicker
              mode="single"
              date={selectedSoldDate}
              onChange={(params) => {
                if (params.date && params.date instanceof Date) {
                  setSelectedSoldDate(params.date);
                }
              }}
            />
            
            <Text style={[styles.modalLabel, { color: activeTheme.text.primary }]}>Prix de vente :</Text>
            <SellingPriceInputModal
              initialPrice={itemToMarkSold?.sellingPrice?.toString() || '0'}
              onConfirm={stableCallbacks.current.handleDateConfirm}
              onCancel={stableCallbacks.current.handleCancelDatePicker}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default function StockScreen() {
  return (
    <ErrorBoundary>
      <StockScreenContent />
    </ErrorBoundary>
  );
}
