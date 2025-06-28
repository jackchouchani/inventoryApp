import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, ActivityIndicator, TextInput, ScrollView, TouchableOpacity, Modal, Platform, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../src/contexts/ThemeContext';
import { useStockActions } from '../../src/hooks/useStockActions';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import type { Item } from '../../src/types/item';

// Hooks Redux optimisés - utilisation des hooks existants pour le chargement initial
import { useItems } from '../../src/hooks/useItems';
import { useCategoriesOptimized as useCategories } from '../../src/hooks/useCategoriesOptimized';
import { useContainersOptimized as useContainers } from '../../src/hooks/useContainersOptimized';
import { useLocationsOptimized as useLocations } from '../../src/hooks/useLocationsOptimized';

// Hooks optimisés pour Redux avec sélecteurs mémoïsés
import { useFilteredItems, useGlobalSearch } from '../../src/hooks/useOptimizedSelectors';
import { ItemFilters } from '../../src/store/selectors';

// Hook Algolia optimisé pour la recherche économique
import { useAlgoliaOptimizedSearch } from '../../src/hooks/useAlgoliaOptimizedSearch';

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

// --- SearchBox optimisée avec gestion scroll iOS PWA ---
const SearchBox: React.FC<SearchBoxProps & { 
  onFocus?: () => void; 
  onBlur?: () => void; 
  inputRef?: React.RefObject<TextInput>;
}> = ({ 
  searchQuery, 
  setSearchQuery, 
  onFocus, 
  onBlur, 
  inputRef 
}) => {
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'FilterBar');
  
  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        style={[styles.filterButton, { flex: 1, marginRight: 0, color: activeTheme.text.primary }]}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Rechercher des articles..."
        placeholderTextColor={activeTheme.text.secondary}
        clearButtonMode="always"
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={onFocus}
        onBlur={onBlur}
        // Propriétés spécifiques pour PWA iOS
        inputMode="search"
        enterKeyHint="search"
      />
    </View>
  );
};

const StockScreenContent = () => {
  const { activeTheme } = useAppTheme();
  const router = useRouter();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemList');
  const [showFilters, setShowFilters] = useState(false);
  
  // États pour gérer le clavier iOS PWA
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  
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
  const { locations, isLoading: locationsLoading, error: locationsError } = useLocations();

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
  const isSearchActive = searchQuery.trim().length >= 2; // Algolia minimum 2 caractères
  
  // Hook Algolia optimisé pour la recherche (avec debounce et pagination)
  const algoliaSearch = useAlgoliaOptimizedSearch(searchQuery, {
    enabled: isSearchActive, // Seulement activer si recherche active
    debounceMs: 400, // 400ms de délai pour économiser les requêtes
    hitsPerPage: 20, // Maximum 20 résultats par page
    minQueryLength: 2 // Minimum 2 caractères
  });
  
  // Fallback Redux pour le filtrage standard (sans recherche)
  const standardResults = useFilteredItems(isSearchActive ? {} : reduxFilters);
  
  // Résultats finaux selon le mode
  const filteredItems = useMemo(() => {
    if (isSearchActive && algoliaSearch.items.length > 0) {
      // En mode recherche Algolia, appliquer les autres filtres localement
      let results = algoliaSearch.items;
      
      if (reduxFilters.status && reduxFilters.status !== 'all') {
        results = results.filter(item => item.status === reduxFilters.status);
      }
      if (reduxFilters.categoryId) {
        results = results.filter(item => item.categoryId === reduxFilters.categoryId);
      }
      if (reduxFilters.containerId !== undefined) {
        if (reduxFilters.containerId === null) {
          results = results.filter(item => item.containerId === null);
        } else {
          results = results.filter(item => item.containerId === reduxFilters.containerId);
        }
      }
      
      // Tri spécial pour les items vendus (même pour Algolia)
      if (reduxFilters.status === 'sold') {
        results = results.sort((a, b) => {
          // Si un item n'a pas de soldAt, le mettre à la fin
          if (!a.soldAt && !b.soldAt) return 0;
          if (!a.soldAt) return 1;
          if (!b.soldAt) return -1;
          
          // Tri décroissant : date la plus récente en premier
          return new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime();
        });
      }
      
      return results;
    } else if (isSearchActive && algoliaSearch.items.length === 0 && !algoliaSearch.isLoading) {
      // Recherche active mais aucun résultat Algolia
      return [];
    } else {
      // Mode filtrage standard Redux (le tri est déjà fait dans les sélecteurs)
      return standardResults;
    }
  }, [isSearchActive, algoliaSearch.items, algoliaSearch.isLoading, standardResults, reduxFilters]);

  // Combiner les états de chargement et erreurs
  const isLoading = (itemsLoading || categoriesLoading || containersLoading || algoliaSearch.isLoading || algoliaSearch.isSearching);
  const error = itemsError || categoriesError || containersError;

  console.log('[StockScreen] Hook data:', { 
    itemsCount: items?.length || 0, 
    filteredCount: filteredItems.length,
    categoriesCount: categories.length, 
    containersCount: containers?.length || 0, 
    isSearchActive,
    algoliaSearching: algoliaSearch.isSearching,
    algoliaLoading: algoliaSearch.isLoading,
    algoliaTotalHits: algoliaSearch.totalHits,
    isLoading, 
    error,
    filters: reduxFilters 
  });

  // Debug pour comprendre les re-renders/refresh
  console.log('[StockScreen] Component render - timestamp:', Date.now());

  // Callbacks pour gérer le scroll iOS PWA
  const handleSearchFocus = useCallback(() => {
    if (Platform.OS === 'web') {
      // Sur iOS PWA, prévenir la perte de contexte de scroll
      setTimeout(() => {
        if (searchInputRef.current) {
          // Cast pour accéder aux API web
          const element = (searchInputRef.current as any)?._nativeTag 
            ? document.querySelector(`[data-tag="${(searchInputRef.current as any)._nativeTag}"]`)
            : null;
          
          if (element && element.scrollIntoView) {
            element.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'nearest' 
            });
          }
        }
      }, 100);
    }
  }, []);

  const handleSearchBlur = useCallback(() => {
    if (Platform.OS === 'web' && isKeyboardVisible) {
      // Forcer le focus sur la liste après la fermeture du clavier
      setTimeout(() => {
        setKeyboardVisible(false);
      }, 200);
    }
  }, [isKeyboardVisible]);

  // Utiliser le hook d'actions du stock
  const { handleMarkAsSold, handleMarkAsAvailable } = useStockActions();

  // Gestion du clavier pour PWA iOS
  useEffect(() => {
    if (Platform.OS === 'web') {
      const keyboardShowListener = Keyboard.addListener('keyboardDidShow', () => {
        setKeyboardVisible(true);
      });
      const keyboardHideListener = Keyboard.addListener('keyboardDidHide', () => {
        setKeyboardVisible(false);
      });

      return () => {
        keyboardShowListener?.remove();
        keyboardHideListener?.remove();
      };
    }
  }, []);

  // Mettre en place les callbacks stables en utilisant useRef
  const stableCallbacks = useRef({
    currentItemToMarkSold: null as Item | null,
    handleItemPress: (item: Item) => {
      // Navigation directe vers la page info de l'item
      // Utiliser REPLACE pour éviter l'accumulation d'historique
      router.replace(`/item/${item.id}/info`);
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
      {/* Barre de recherche optimisée avec gestion scroll iOS PWA */}
      <SearchBox 
        searchQuery={searchQuery} 
        setSearchQuery={setSearchQuery}
        onFocus={handleSearchFocus}
        onBlur={handleSearchBlur}
        inputRef={searchInputRef}
      />
      
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

      {/* Indicateur de recherche Algolia */}
      {isSearchActive && (
        <View style={{
          backgroundColor: activeTheme.primary + '10',
          borderColor: activeTheme.primary + '30',
          borderWidth: 1,
          borderRadius: 6,
          paddingHorizontal: 12,
          paddingVertical: 6,
          marginHorizontal: 12,
          marginBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Text style={{
            color: activeTheme.primary,
            fontSize: 12,
            fontWeight: '500'
          }}>
            🔍 Recherche Algolia • {algoliaSearch.totalHits} résultat{algoliaSearch.totalHits > 1 ? 's' : ''}
          </Text>
          {algoliaSearch.canLoadMore && (
            <Text style={{
              color: activeTheme.text.secondary,
              fontSize: 11
            }}>
              Scroll pour plus
            </Text>
          )}
        </View>
      )}

      {/* Liste virtualisée optimisée avec gestion iOS PWA */}
      <View 
        style={{ flex: 1 }}
        // Styles web spécifiques pour iOS PWA 
        {...(Platform.OS === 'web' && isKeyboardVisible && {
          style: {
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y pinch-zoom',
          } as any
        })}
      >
        <VirtualizedItemList
          items={filteredItems}
          categories={categories}
          containers={containers}
          isLoading={isLoading}
          onItemPress={stableCallbacks.current.handleItemPress}
          onMarkAsSold={stableCallbacks.current.handleMarkAsSoldPress}
          onMarkAsAvailable={stableCallbacks.current.handleMarkAsAvailablePress}
          onEndReached={isSearchActive ? algoliaSearch.loadMore : loadMore}
          isLoadingMore={isSearchActive ? algoliaSearch.isSearching : (itemsLoading && items.length > 0)}
          estimatedItemSize={120}
        />
      </View>

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
              styles={{
                // Cases des jours
                day: {
                  backgroundColor: 'transparent',
                  borderRadius: 8,
                },
                day_label: {
                  color: activeTheme.text.primary,
                  fontSize: 16,
                },
                // Jour d'aujourd'hui
                today: {
                  backgroundColor: activeTheme.primary + '20', // 20% d'opacité
                  borderColor: activeTheme.primary,
                  borderWidth: 2,
                  borderRadius: 8,
                },
                today_label: {
                  color: activeTheme.primary,
                  fontWeight: '600',
                },
                // Jour sélectionné - LE PLUS IMPORTANT pour voir la sélection
                selected: {
                  backgroundColor: activeTheme.primary,
                  borderRadius: 8,
                },
                selected_label: {
                  color: activeTheme.text.onPrimary,
                  fontWeight: '600',
                },
                // Jours désactivés
                disabled: {
                  opacity: 0.3,
                },
                disabled_label: {
                  color: activeTheme.text.disabled,
                },
              } as any}
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
