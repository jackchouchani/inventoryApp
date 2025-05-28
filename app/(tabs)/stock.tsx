import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, Platform, ActivityIndicator, TextInput, ScrollView, TouchableOpacity, Modal, TextStyle, ViewStyle } from 'react-native';
import { useAppTheme, type AppThemeType } from '../../src/contexts/ThemeContext';
import ItemList from '../../src/components/ItemList';
import { useStockActions } from '../../src/hooks/useStockActions';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import type { Item } from '../../src/types/item';

// Hooks Redux pour les entités principales  
import { useItems } from '../../src/hooks/useItems';
import { useCategories } from '../../src/hooks/useCategories';
import { useContainers } from '../../src/hooks/useContainers';

import { useRefreshStore } from '../../src/store/refreshStore';
import AlgoliaStockList from '../../src/components/AlgoliaStockList';
import DateTimePicker, { useDefaultStyles } from 'react-native-ui-datepicker';

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

const MemoizedItemList = React.memo(ItemList);

// --- Créer un nouveau composant pour l'input du prix et les boutons du modal ---
const SellingPriceInputModal: React.FC<{
    initialPrice: string;
    onConfirm: (price: string) => void; // Accepte la saisie comme string
    onCancel: () => void;
}> = ({ initialPrice, onConfirm, onCancel }) => {
    const { activeTheme } = useAppTheme();
    const styles = getThemedStyles(activeTheme);
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
                style={styles.salePriceInput}
                value={localEditableSalePrice}
                onChangeText={handleLocalPriceChange}
                placeholder="Prix de vente"
                keyboardType="numeric"
                placeholderTextColor={activeTheme.text.secondary}
            />
            <View style={styles.datePickerButtonsContainer}>
                <TouchableOpacity
                    style={[styles.datePickerButton, styles.datePickerCancelButton]}
                    onPress={onCancel}>
                    <Text style={styles.datePickerButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.datePickerButton, styles.datePickerConfirmButton]}
                    onPress={() => onConfirm(localEditableSalePrice)}>
                    <Text style={[styles.datePickerButtonText, styles.datePickerConfirmButtonText]}>OK</Text>
                </TouchableOpacity>
            </View>
        </>
    );
};

// --- Nouvelle SearchBox ---
// Utilise l'interface SearchBoxProps pour typer les props
const SearchBox: React.FC<SearchBoxProps> = ({ searchQuery, setSearchQuery }) => {
  const { activeTheme } = useAppTheme();
  const styles = getThemedStyles(activeTheme);
  
  return (
    <View style={styles.searchBoxContainer}>
      <TextInput
        style={styles.searchBoxInput}
        value={searchQuery}
        // Quand le texte change, on met à jour l'état local.
        // L'effet secondaire (useEffect) gérera l'appel debounced à algoliaSearch.
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
  const styles = getThemedStyles(activeTheme);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  // --- STATES ---
  const [filters, setFilters] = useState<StockFilters>({ status: 'available' });
  const [searchQuery, setSearchQuery] = useState('');
  const refreshTimestamp = useRefreshStore(state => state.refreshTimestamp);

  // *** ÉTATS POUR LE MODAL DE DATE DE VENTE ***
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [itemToMarkSold, setItemToMarkSold] = useState<Item | null>(null);
  // Stocker la date comme un objet Date, initialisé à la date actuelle
  const [selectedSoldDate, setSelectedSoldDate] = useState<Date>(new Date());
  // ******************************************

  // Récupérer les styles par défaut du date picker
  const defaultPickerStyles = useDefaultStyles();

  // --- REFS ---

  // --- Utilisation des hooks Redux pour les entités principales --- //
  const { data: inventoryData, isLoading: isLoadingInventory, error: errorInventory } = useItems();

  // Utiliser les hooks Redux pour categories et containers
  const { categories: categoriesData, isLoading: isLoadingCategories, error: errorCategories } = useCategories();
  const { data: containersData, isLoading: isLoadingContainers, error: errorContainers } = useContainers();

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
        } else {
            console.error('[handleDateConfirm] Cannot proceed: itemToProcess or selectedSoldDate is null',
                { itemToProcess, selectedSoldDate });
            // Fermer le modal si les données sont invalides
            setDatePickerVisibility(false);
            setItemToMarkSold(null);
            stableCallbacks.current.currentItemToMarkSold = null;
        }
    },
    handleDateCancel: () => {
        setDatePickerVisibility(false);
        setItemToMarkSold(null);
        stableCallbacks.current.currentItemToMarkSold = null;
    },
    handleMarkAsSold: handleMarkAsSold,
    handleMarkAsAvailable: handleMarkAsAvailable,
  });

  // --- Filter inventoryData in memory based on filters state ---
  // Ce filtre s'applique UNIQUEMENT quand Algolia n'est PAS actif (searchQuery est vide)
  const filteredInventoryData = useMemo(() => {
    // Si searchQuery est non vide, retournez un tableau vide, car on utilise Algolia
    if (!inventoryData || searchQuery) return [];


    return inventoryData.filter(item => {
      // Filter by category
      if (filters.categoryName) {
        // Check if the category filter is 'Toutes', which means no filter
        if (filters.categoryName !== 'Toutes') {
          const category = (categoriesData || []).find(cat => cat.name === filters.categoryName);
          if (!category || item.categoryId !== category.id) return false;
        }
      }

      // Filter by container
      if (filters.containerName) {
         // Check if the container filter is 'Tous', which means no filter
         if (filters.containerName !== 'Tous') {
           // Find container by both name and name#number format
           const container = (containersData || []).find(cont =>
             cont.name === filters.containerName || `${cont.name}#${cont.number}` === filters.containerName
           );
           if (!container || item.containerId !== container.id) return false;
         }
      }

      // Filter by status
      if (filters.status && filters.status !== 'all') {
        if (item.status !== filters.status) return false;
      }

      // Filter by price range
      if (filters.minPrice !== undefined && item.sellingPrice < filters.minPrice) return false;
      if (filters.maxPrice !== undefined && item.sellingPrice > filters.maxPrice) return false;

      return true;
    });
  }, [inventoryData, filters, categoriesData, containersData, refreshTimestamp, searchQuery]); // Dépend de searchQuery


  // --- LOGIQUE DE SÉLECTION DE LA SOURCE DE DONNÉES ---
  // On utilise Algolia si searchQuery est non vide, sinon on utilise les données filtrées de l'inventaire
  const isSearchActive = !!searchQuery;

  // L'état de chargement dépend de la source de données active
  const isLoading = isSearchActive ? false : isLoadingInventory;
  // Les erreurs ne sont affichées que si Algolia n'est pas actif et qu'il y a une erreur React Query
  const errorToDisplay = isSearchActive ? null : errorInventory;
  // L'état de chargement plus dépend de la source de données active
  const isLoadingMore = isSearchActive ? false : false;


  // --- Handle Load More (Algolia only for now) ---
  const handleLoadMore = useCallback(() => {
    // La logique loadMore pour Algolia est maintenant dans AlgoliaStockList
    // La liste locale ne gère pas la pagination pour l'instant
  }, [isSearchActive]); // Dépend de isSearchActive


  // --- Filtres custom (par nom) ---
  // Ces filtres sont utilisés uniquement quand isSearchActive est false
  const CategoryFilter = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterOptionsContainer}>
      <TouchableOpacity
        style={[styles.filterButton, !filters.categoryName && styles.filterButtonActive]}
        // Modified: Set filter value to undefined for 'Toutes'
        onPress={() => setFilters(f => ({ ...f, categoryName: undefined }))}>
        <Text style={[styles.filterButtonText, !filters.categoryName && styles.filterButtonTextActive]}>Toutes</Text>
      </TouchableOpacity>
      {(categoriesData || []).map(cat => (
        <TouchableOpacity
          key={cat.id}
          style={[styles.filterButton, filters.categoryName === cat.name && styles.filterButtonActive]}
          onPress={() => setFilters(f => ({ ...f, categoryName: cat.name }))}>
          <Text style={[styles.filterButtonText, filters.categoryName === cat.name && styles.filterButtonTextActive]}>{cat.name}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
  const ContainerFilter = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterOptionsContainer}>
      <TouchableOpacity
        style={[styles.filterButton, !filters.containerName && styles.filterButtonActive]}
        // Modified: Set filter value to undefined for 'Tous'
        onPress={() => setFilters(f => ({ ...f, containerName: undefined }))}>
        <Text style={[styles.filterButtonText, !filters.containerName && styles.filterButtonTextActive]}>Tous</Text>
      </TouchableOpacity>
      {(containersData || []).map(cont => (
        <TouchableOpacity
          key={cont.id}
          // Modified: Check both name and name#number for selection
          style={[styles.filterButton, filters.containerName === `${cont.name}#${cont.number}` && styles.filterButtonActive]}
          // Modified: Set filter value as name#number
          onPress={() => setFilters(f => ({ ...f, containerName: `${cont.name}#${cont.number}` }))}>
          {/* Modified: Display name#number */}
          <Text style={[styles.filterButtonText, filters.containerName === `${cont.name}#${cont.number}` && styles.filterButtonTextActive]}>{`${cont.name}#${cont.number}`}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
  const StatusFilter = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterOptionsContainer}>
      {(['all', 'available', 'sold'] as const).map(status => (
        <TouchableOpacity
          key={status}
          style={[styles.filterButton, filters.status === status && styles.filterButtonActive]}
          onPress={() => setFilters(f => ({ ...f, status }))}>
          <Text style={[styles.filterButtonText, filters.status === status && styles.filterButtonTextActive]}>{status === 'all' ? 'Tous' : status === 'available' ? 'Disponible' : 'Vendu'}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // Display loading indicator or error message based on the active data source
  // Inclure le chargement Algolia si isSearchActive est true
  if (isLoading || isLoadingCategories || isLoadingContainers) { // Include loading for categories and containers
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
      </View>
    );
  }

  // Show error message (but not for Algolia search errors)
  if (errorToDisplay || errorCategories || errorContainers) {
    // Traitement des erreurs string et Error
    const errorMessage = errorToDisplay || errorCategories || errorContainers || 'Une erreur inconnue est survenue';

    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Une erreur est survenue :</Text>
        <Text style={styles.errorDetails}>{errorMessage}</Text>
      </View>
    );
  }

  return (
      <View style={styles.container}>
      {/* La SearchBox met à jour l'état searchQuery */}
      <SearchBox searchQuery={searchQuery} setSearchQuery={setSearchQuery}/>
      <TouchableOpacity style={styles.filtersToggleHeader} onPress={() => setShowFilters(!showFilters)}>
        <Text style={styles.filtersToggleHeaderText}>Filtrer les articles</Text>
      </TouchableOpacity>
      {/* Les filtres custom sont affichés uniquement si la recherche Algolia n'est PAS active */}
      {showFilters && !isSearchActive && (
        <View style={styles.filtersContainer}>
          <CategoryFilter/>
          <ContainerFilter/>
          <StatusFilter/>
        </View>
      )}
      {/* Display no results message handled within AlgoliaStockList or ItemList */}
      {/* Le message est maintenant géré à l'intérieur des listes */}
      {/* {itemsToDisplay.length === 0 && !isLoading && ( // Check !isLoading to avoid showing message while loading
         <View style={styles.noResultsContainer}>
           <Text style={styles.noResultsText}>Aucun article trouvé.</Text>
         </View>
       )} */}
        {/* Affiche la liste Algolia SEULEMENT si recherche active */}
        {isSearchActive ? (
          <AlgoliaStockList
            searchQuery={searchQuery}
            onItemPress={stableCallbacks.current.handleItemPress}
            onMarkAsSold={stableCallbacks.current.handleMarkAsSoldPress}
            onMarkAsAvailable={stableCallbacks.current.handleMarkAsAvailablePress}
            categories={categoriesData || []}
            containers={containersData || []}
            selectedItem={selectedItem}
            onEditSuccess={stableCallbacks.current.handleEditSuccess}
            onEditCancel={stableCallbacks.current.handleEditCancel}
            onEndReached={handleLoadMore} // onEndReached pour Algolia est géré dans le composant
            isLoadingMore={isLoadingMore} // l'état isLoadingMore est géré dans le composant Algolia
          />
        ) : (
          <MemoizedItemList
            items={filteredInventoryData}
            onItemPress={stableCallbacks.current.handleItemPress}
            onMarkAsSold={stableCallbacks.current.handleMarkAsSoldPress}
            onMarkAsAvailable={stableCallbacks.current.handleMarkAsAvailablePress}
            categories={categoriesData || []}
            containers={containersData || []}
            onEndReached={handleLoadMore} // onEndReached pour la liste locale ne fait rien
            isLoadingMore={isLoadingMore} // toujours false pour la liste locale
          />
        )}

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
                                color: activeTheme.text.onPrimary,
                            },
                            selected: {
                                ...(defaultPickerStyles.selected as ViewStyle),
                                backgroundColor: activeTheme.primary,
                            },
                            today: {
                                ...(defaultPickerStyles.today as ViewStyle),
                                borderColor: activeTheme.primary,
                                borderWidth: 1,
                            },
                            day_label: {
                                ...(defaultPickerStyles.day_label as TextStyle),
                                color: activeTheme.text.primary,
                            },
                            disabled_label: {
                                ...(defaultPickerStyles.disabled_label as TextStyle),
                                color: activeTheme.text.disabled,
                            },
                            month_label: {
                                ...(defaultPickerStyles.month_label as TextStyle),
                                color: activeTheme.text.primary,
                                fontWeight: 'bold',
                            },
                            year_label: {
                                ...(defaultPickerStyles.year_label as TextStyle),
                                color: activeTheme.text.primary,
                                fontWeight: 'bold',
                            },
                         }}
                         locale="fr"
                    />
                    <Text style={styles.salePriceInputLabel}>Prix de vente (€) :</Text>
                    {/* --- Utilise SellingPriceInputModal --*/}
                    {itemToMarkSold && ( // S'assurer que itemToMarkSold existe avant de rendre SellingPriceInputModal
                        <SellingPriceInputModal
                            initialPrice={itemToMarkSold.sellingPrice?.toString() || "0"} // <-- Utilise le prix de l'item, fallback à "0"
                            onConfirm={(price) => { // <-- price est la valeur saisie du modal
                                stableCallbacks.current.handleDateConfirm(price); // <-- Passe la valeur à handleDateConfirm
                            }}
                            onCancel={stableCallbacks.current.handleDateCancel}
                        />
                    )}
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
      <StockScreenContent />
    </ErrorBoundary>
  );
}

const getThemedStyles = (theme: AppThemeType) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.background,
  },
  errorText: {
    fontSize: 16,
    color: theme.danger.main,
    textAlign: 'center',
  },
  errorDetails: {
    fontSize: 14,
    color: theme.text.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.background,
  },
  loadingText: {
    fontSize: 16,
    color: theme.primary,
    marginTop: 12,
    textAlign: 'center',
  },
  searchBoxContainer: {
    padding: Platform.OS === 'web' ? 12 : 8,
    backgroundColor: Platform.OS === 'web' ? theme.surface : theme.background,
    borderBottomWidth: Platform.OS === 'web' ? 1 : 0,
    borderBottomColor: Platform.OS === 'web' ? theme.border : 'transparent',
  },
  searchBoxInput: {
    backgroundColor: theme.surface,
    height: 40,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text.primary,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.background,
  },
  noResultsText: {
    fontSize: 16,
    color: theme.text.secondary,
  },
  filtersContainer: {
    paddingVertical: 8,
    paddingHorizontal: Platform.OS === 'web' ? 12 : 8,
    backgroundColor: Platform.OS === 'web' ? theme.surface : theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  filterSection: {
    marginBottom: theme.spacing.sm,
  },
  filterTitle: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
    color: theme.text.primary,
    marginBottom: theme.spacing.xs,
  },
  filterOptionsContainer: {
    paddingVertical: theme.spacing.xs,
  },
  filterButton: {
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.border,
  },
  filterButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  filterButtonText: {
    fontSize: 13,
    color: theme.text.primary,
  },
  filterButtonTextActive: {
    color: theme.text.inverse,
    fontWeight: '500',
  },
  toggleFilterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: theme.spacing.sm,
  },
  filtersToggleHeader: {
    padding: Platform.OS === 'web' ? 12 : 8,
    backgroundColor: Platform.OS === 'web' ? theme.surface : theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filtersToggleHeaderText: {
    fontSize: theme.typography.h2.fontSize,
    fontWeight: '600',
    color: theme.text.primary,
  },
  datePickerModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.backdrop,
  },
  datePickerModalContent: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    width: 300,
    alignItems: 'center',
    // Consider using theme.shadows.md for platform-specific shadows
    ...(Platform.OS === 'web' ? { boxShadow: theme.shadows.md.boxShadow } : { elevation: theme.shadows.md.elevation }),
  },
  datePickerModalTitle: {
    fontSize: theme.typography.h2.fontSize,
    fontWeight: 'bold',
    marginBottom: theme.spacing.md,
    color: theme.text.primary,
  },
  salePriceInputLabel: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    fontSize: theme.typography.body.fontSize,
    color: theme.text.primary,
    alignSelf: 'flex-start',
  },
  salePriceInput: {
    height: 40,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    width: '100%',
    backgroundColor: theme.surface,
    fontSize: theme.typography.body.fontSize,
    color: theme.text.primary,
  },
  datePickerButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  datePickerButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    minWidth: 100,
    alignItems: 'center',
  },
  datePickerCancelButton: {},
  datePickerConfirmButton: {
    backgroundColor: theme.primary,
  },
  datePickerButtonText: {
    fontSize: theme.typography.body.fontSize,
    color: theme.primary,
  },
  datePickerConfirmButtonText: {
    color: theme.text.inverse,
    fontWeight: 'bold',
  },
});
