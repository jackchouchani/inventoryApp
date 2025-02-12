import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { Item, Container, Category } from '../database/database';
import { useRefreshStore } from '../store/refreshStore';
import { ItemEditForm } from './ItemEditForm';
import { MaterialIcons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { selectAllItems, selectFilteredItems, selectItemsStatistics } from '../store/itemsSlice';
import { selectAllCategories } from '../store/categorySlice';
import { selectAllContainers, selectContainerById } from '../store/containersSlice';
import { useInventoryData } from '../hooks/useInventoryData';
import { updateItemStatus, moveItem } from '../store/itemsThunks';
import { AppDispatch } from '../store/store';
import { useAnimatedComponents, ANIMATION_PRESETS } from '../hooks/useAnimatedComponents';
import { offlineSyncManager } from '../services/offlineSync';
import Animated from 'react-native-reanimated';
import ItemCard from './ItemCard';

interface ItemListProps {
  onMarkAsSold: (itemId: number) => void;
  onMarkAsAvailable: (itemId: number) => void;
  onMoveItem?: (itemId: number, newContainerId: number) => void;
  onItemPress?: (item: Item) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

interface Filters {
  search: string;
  categoryId: number | null;
  containerId: 'none' | number | null;
  status: 'all' | 'available' | 'sold';
  minPrice: string;
  maxPrice: string;
}

const ItemListModal: React.FC<{
  selectedItem: Item | null;
  containers: Container[];
  categories: Category[];
  onSuccess: () => void;
  onCancel: () => void;
}> = ({ selectedItem, containers, categories, onSuccess, onCancel }) => {
  return (
    <Modal
      visible={!!selectedItem}
      animationType="slide"
      onRequestClose={onCancel}
    >
      {selectedItem && (
        <ItemEditForm
          item={selectedItem}
          containers={containers}
          categories={categories}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      )}
    </Modal>
  );
};

export const ItemList: React.FC<ItemListProps> = ({
  onMarkAsSold,
  onMarkAsAvailable,
  onMoveItem,
  onItemPress,
  onLoadMore,
  hasMore = false,
  isLoading = false,
}) => {
  // Hooks d'animation - Déplacés au niveau racine du composant
  const { useFadeAnimation, useScaleAnimation } = useAnimatedComponents();
  const fadeAnimation = useFadeAnimation(0);
  const scaleAnimation = useScaleAnimation(1);

  // États - Tous les useState au début
  const [filters, setFilters] = useState<Filters>({
    search: '',
    categoryId: null,
    containerId: null,
    status: 'all',
    minPrice: '',
    maxPrice: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  // Hooks Redux
  const dispatch = useDispatch<AppDispatch>();
  const triggerRefresh = useRefreshStore(state => state.triggerRefresh);
  const refreshTimestamp = useRefreshStore(state => state.refreshTimestamp);

  // Sélecteurs Redux avec valeurs par défaut
  const items = useSelector(selectAllItems) || [];
  const categories = useSelector(selectAllCategories) || [];
  const containers = useSelector(selectAllContainers) || [];
  const statistics = useSelector(selectItemsStatistics);

  // Hook d'inventaire avec valeurs par défaut
  const {
    items: paginatedItems = [],
    categories: paginatedCategories = [],
    containers: paginatedContainers = [],
    isLoading: dataLoading = false,
    error = null,
    hasMore: dataHasMore = false,
    fetchNextPage,
    refetch
  } = useInventoryData({
    search: filters.search,
    categoryId: filters.categoryId ?? undefined,
    containerId: filters.containerId ?? undefined,
    status: filters.status === 'all' ? undefined : filters.status,
    minPrice: filters.minPrice ? parseFloat(filters.minPrice) : undefined,
    maxPrice: filters.maxPrice ? parseFloat(filters.maxPrice) : undefined,
  });

  // Callbacks mémorisés
  const handleSearchChange = useCallback((text: string) => {
    setFilters(prev => ({ ...prev, search: text }));
  }, []);

  const handleCategoryFilter = useCallback((categoryId: number | null) => {
    setFilters(prev => ({
      ...prev,
      categoryId: prev.categoryId === categoryId ? null : categoryId
    }));
  }, []);

  const handleContainerFilter = useCallback((containerId: 'none' | number | null) => {
    setFilters(prev => ({
      ...prev,
      containerId: prev.containerId === containerId ? null : containerId
    }));
  }, []);

  const handleStatusFilter = useCallback((status: 'all' | 'available' | 'sold') => {
    setFilters(prev => ({ ...prev, status }));
  }, []);

  const handleMinPriceChange = useCallback((value: string) => {
    setFilters(prev => ({
      ...prev,
      minPrice: value
    }));
  }, []);

  const handleMaxPriceChange = useCallback((value: string) => {
    setFilters(prev => ({
      ...prev,
      maxPrice: value
    }));
  }, []);

  const handleStatusToggle = useCallback(async (itemId: number, currentStatus: string) => {
    try {
      await dispatch(updateItemStatus({ 
        itemId, 
        status: currentStatus === 'available' ? 'sold' : 'available' 
      }));
      refetch();
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
    }
  }, [dispatch, refetch]);

  const handleModalCancel = useCallback(() => {
    setSelectedItem(null);
  }, []);

  const handleModalSuccess = useCallback(() => {
    setSelectedItem(null);
    refetch();
  }, [refetch]);

  const handleLoadMore = useCallback(() => {
    if (dataHasMore) {
      fetchNextPage();
    }
  }, [dataHasMore, fetchNextPage]);

  const handleItemPress = useCallback((item: Item) => {
    setSelectedItem(item);
  }, []);

  // Effets
  useEffect(() => {
    if (paginatedItems.length > 0) {
      setSelectedItem(null);
    }
  }, [paginatedItems]);

  useEffect(() => {
    const applyFilters = () => {
      if (filters.search || filters.categoryId || filters.containerId || filters.status !== 'all' || filters.minPrice || filters.maxPrice) {
        refetch();
      }
    };
    applyFilters();
  }, [filters, refetch]);

  useEffect(() => {
    const syncData = async () => {
      const isStale = await offlineSyncManager.isDataStale();
      if (isStale) {
        await offlineSyncManager.saveOfflineData({
          items: paginatedItems,
          categories,
          containers
        });
      }
    };
    syncData();
  }, [paginatedItems, categories, containers]);

  // Mémoisation des props de la FlatList
  const flatListProps = useMemo(() => ({
    data: paginatedItems,
    renderItem: ({ item }: { item: Item }) => (
      <ItemCard
        item={item}
        onPress={() => handleItemPress(item)}
        fadeAnimation={fadeAnimation}
        scaleAnimation={scaleAnimation}
      />
    ),
    keyExtractor: (item: Item) => item.id?.toString() || '',
    style: styles.list,
    onEndReached: handleLoadMore,
    onEndReachedThreshold: 0.5,
    ListFooterComponent: dataHasMore ? (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    ) : null,
    initialNumToRender: 10,
    maxToRenderPerBatch: 10,
    windowSize: 5,
    removeClippedSubviews: true,
    maintainVisibleContentPosition: {
      minIndexForVisible: 0,
    }
  }), [paginatedItems, handleItemPress, handleLoadMore, dataHasMore, fadeAnimation, scaleAnimation]);

  // Rendu conditionnel pour le chargement
  if (dataLoading && (!paginatedItems || paginatedItems.length === 0)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Rendu conditionnel pour les erreurs
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error.toString()}</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => { refetch(); }}
        >
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Rendu principal
  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher des articles..."
          value={filters.search}
          onChangeText={handleSearchChange}
        />
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Text>Filtres</Text>
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filtersContainer}>
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Catégorie</Text>
            <View style={styles.filterOptions}>
              {paginatedCategories?.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.filterOption,
                    filters.categoryId === category.id && styles.filterOptionSelected,
                  ]}
                  onPress={() => handleCategoryFilter(category.id ?? null)}
                >
                  <Text style={styles.filterOptionText}>{category.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Container</Text>
            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  filters.containerId === 'none' && styles.filterOptionSelected,
                ]}
                onPress={() => handleContainerFilter('none')}
              >
                <Text style={styles.filterOptionText}>Sans container</Text>
              </TouchableOpacity>
              {paginatedContainers?.map((container) => (
                <TouchableOpacity
                  key={container.id}
                  style={[
                    styles.filterOption,
                    filters.containerId === container.id && styles.filterOptionSelected,
                  ]}
                  onPress={() => handleContainerFilter(container.id ?? null)}
                >
                  <Text style={styles.filterOptionText}>{container.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>État</Text>
            <View style={styles.filterOptions}>
              {[
                { value: 'all', label: 'Tous' },
                { value: 'available', label: 'Disponible' },
                { value: 'sold', label: 'Vendu' }
              ].map((status) => (
                <TouchableOpacity
                  key={status.value}
                  style={[
                    styles.filterOption,
                    filters.status === status.value && styles.filterOptionSelected,
                  ]}
                  onPress={() => handleStatusFilter(status.value as 'all' | 'available' | 'sold')}
                >
                  <Text style={styles.filterOptionText}>{status.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Prix</Text>
            <View style={styles.priceInputs}>
              <TextInput
                style={styles.priceInput}
                placeholder="Min"
                value={filters.minPrice}
                onChangeText={handleMinPriceChange}
                keyboardType="numeric"
              />
              <Text style={styles.priceSeparator}>-</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="Max"
                value={filters.maxPrice}
                onChangeText={handleMaxPriceChange}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>
      )}

      <FlatList {...flatListProps} />

      <ItemListModal
        selectedItem={selectedItem}
        containers={paginatedContainers ?? []}
        categories={paginatedCategories ?? []}
        onSuccess={handleModalSuccess}
        onCancel={handleModalCancel}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchBar: {
    flexDirection: 'row',
    padding: 10,
    gap: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
  },
  filterButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
  },
  filtersContainer: {
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  filterSection: {
    marginBottom: 15,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterOptionText: {
    fontSize: 12,
    color: '#333',
  },
  list: {
    flex: 1,
  },
  itemContainer: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceLabel: {
    color: '#666',
  },
  price: {
    fontWeight: 'bold',
    color: '#2ecc71',
  },
  itemDetails: {
    gap: 5,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailText: {
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
    gap: 5,
  },
  soldButton: {
    backgroundColor: '#e74c3c',
  },
  availableButton: {
    backgroundColor: '#2ecc71',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  priceInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priceInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
  },
  priceSeparator: {
    color: '#666',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 10,
  },
  itemInfo: {
    flex: 1,
  },
});