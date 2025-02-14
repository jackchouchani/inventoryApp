import React, { useState, useCallback, useMemo, memo, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { Item } from '../types/item';
import { Container } from '../types/container';
import { Category } from '../types/category';
import { ItemEditForm } from './ItemEditForm';
import { MaterialIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { selectAllCategories } from '../store/categorySlice';
import { selectAllContainers } from '../store/containersSlice';
import { useAnimatedComponents } from '../hooks/useAnimatedComponents';
import ItemCard from './ItemCard';
import { Skeleton } from './Skeleton';
import { withPerformanceMonitoring } from '../hoc/withPerformanceMonitoring';
import { monitoring } from '../services/monitoring';

interface ItemListProps {
  items: Item[];
  onMarkAsSold: (itemId: number) => void;
  onMarkAsAvailable: (itemId: number) => void;
  onMoveItem?: (itemId: number, newContainerId: number) => void;
  onItemPress?: (item: Item) => void;
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
      transparent={true}
      onRequestClose={onCancel}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Modifier l'article</Text>
            <TouchableOpacity style={styles.modalCloseButton} onPress={onCancel}>
              <MaterialIcons name="close" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>
          {selectedItem && (
            <ItemEditForm
              item={selectedItem}
              containers={containers}
              categories={categories}
              onSuccess={onSuccess}
              onCancel={onCancel}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const ItemRow = memo(({ 
  item, 
  onMarkAsSold, 
  onMarkAsAvailable,
  onPress
}: { 
  item: Item; 
  onMarkAsSold?: (id: number) => void;
  onMarkAsAvailable?: (id: number) => void;
  onPress?: () => void;
}) => {
  const handleMarkAsSold = () => {
    if (onMarkAsSold) onMarkAsSold(item.id);
  };

  const handleMarkAsAvailable = () => {
    if (onMarkAsAvailable) onMarkAsAvailable(item.id);
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.itemRow}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemPrice}>{item.sellingPrice}€</Text>
      </View>
      <View style={styles.itemActions}>
        <Text style={[
          styles.itemStatus,
          item.status === 'sold' ? styles.soldStatus : styles.availableStatus
        ]}>
          {item.status === 'sold' ? 'Vendu' : 'Disponible'}
        </Text>
        {item.status === 'available' ? (
          <TouchableOpacity onPress={handleMarkAsSold} style={styles.actionButton}>
            <Text style={styles.buttonText}>Marquer comme vendu</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleMarkAsAvailable} style={styles.actionButton}>
            <Text style={styles.buttonText}>Remettre en stock</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
});

const LoadingSkeleton = memo(() => (
  <View style={styles.skeletonContainer}>
    {Array.from({ length: 5 }).map((_, index) => (
      <View key={index} style={styles.skeletonRow}>
        <Skeleton style={styles.skeletonName} />
        <Skeleton style={styles.skeletonPrice} />
        <Skeleton style={styles.skeletonStatus} />
        <Skeleton style={styles.skeletonButton} />
      </View>
    ))}
  </View>
));

const ItemList = memo<ItemListProps>(({
  items,
  onMarkAsSold,
  onMarkAsAvailable,
  onMoveItem,
  onItemPress,
  isLoading
}) => {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    categoryId: null,
    containerId: null,
    status: 'all',
    minPrice: '',
    maxPrice: '',
  });

  const {
    opacity,
    fadeIn,
    fadeOut,
    fadeStyle,
    scale,
    scaleUp,
    scaleDown,
    scaleStyle
  } = useAnimatedComponents();

  const categories = useSelector(selectAllCategories);
  const containers = useSelector(selectAllContainers);

  const renderStartTime = useRef(Date.now());
  
  useEffect(() => {
    return () => {
      const renderDuration = Date.now() - renderStartTime.current;
      monitoring.recordMetric({
        type: 'RENDER',
        name: 'ItemList',
        duration: renderDuration,
        metadata: {
          itemCount: items.length,
          isLoading
        }
      });
    };
  });

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(filters.search.toLowerCase());
      const matchesCategory = !filters.categoryId || item.categoryId === filters.categoryId;
      const matchesContainer = !filters.containerId || 
        (filters.containerId === 'none' ? !item.containerId : item.containerId === filters.containerId);
      const matchesStatus = filters.status === 'all' || item.status === filters.status;
      const matchesPrice = (!filters.minPrice || item.sellingPrice >= parseFloat(filters.minPrice)) &&
        (!filters.maxPrice || item.sellingPrice <= parseFloat(filters.maxPrice));

      return matchesSearch && matchesCategory && matchesContainer && matchesStatus && matchesPrice;
    });
  }, [items, filters]);

  const handleModalSuccess = useCallback(() => {
    setSelectedItem(null);
  }, []);

  const handleModalCancel = useCallback(() => {
    setSelectedItem(null);
  }, []);

  const handleItemPress = useCallback((item: Item) => {
    setSelectedItem(item);
    if (onItemPress) {
      onItemPress(item);
    }
  }, [onItemPress]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      // Trier par statut (disponible en premier)
      if (a.status !== b.status) {
        return a.status === 'available' ? -1 : 1;
      }
      // Puis par date de mise à jour
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [filteredItems]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!items.length) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Aucun article trouvé</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher des articles..."
          value={filters.search}
          onChangeText={(text) => setFilters(prev => ({ ...prev, search: text }))}
        />
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <MaterialIcons name="filter-list" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filtersContainer}>
          <ScrollView>
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Catégorie</Text>
              <View style={styles.filterOptions}>
                {categories?.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.filterOption,
                      filters.categoryId === category.id && styles.filterOptionSelected,
                    ]}
                    onPress={() => setFilters(prev => ({
                      ...prev,
                      categoryId: prev.categoryId === category.id ? null : category.id
                    }))}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.categoryId === category.id && styles.filterOptionTextSelected
                    ]}>{category.name}</Text>
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
                  onPress={() => setFilters(prev => ({
                    ...prev,
                    containerId: prev.containerId === 'none' ? null : 'none'
                  }))}
                >
                  <Text style={[
                    styles.filterOptionText,
                    filters.containerId === 'none' && styles.filterOptionTextSelected
                  ]}>Sans container</Text>
                </TouchableOpacity>
                {containers?.map((container) => (
                  <TouchableOpacity
                    key={container.id}
                    style={[
                      styles.filterOption,
                      filters.containerId === container.id && styles.filterOptionSelected,
                    ]}
                    onPress={() => setFilters(prev => ({
                      ...prev,
                      containerId: prev.containerId === container.id ? null : container.id
                    }))}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.containerId === container.id && styles.filterOptionTextSelected
                    ]}>{container.name}</Text>
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
                    onPress={() => setFilters(prev => ({ ...prev, status: status.value as any }))}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.status === status.value && styles.filterOptionTextSelected
                    ]}>{status.label}</Text>
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
                  onChangeText={(value) => setFilters(prev => ({ ...prev, minPrice: value }))}
                  keyboardType="numeric"
                />
                <Text style={styles.priceSeparator}>-</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="Max"
                  value={filters.maxPrice}
                  onChangeText={(value) => setFilters(prev => ({ ...prev, maxPrice: value }))}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </ScrollView>
        </View>
      )}

      <FlatList
        data={sortedItems}
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            onPress={() => handleItemPress(item)}
            onMarkAsSold={onMarkAsSold}
            onMarkAsAvailable={onMarkAsAvailable}
            fadeAnimation={{
              opacity,
              fadeIn,
              fadeOut,
              fadeStyle
            }}
            scaleAnimation={{
              scale,
              scaleUp,
              scaleDown,
              scaleStyle
            }}
          />
        )}
        keyExtractor={(item) => item.id?.toString() || ''}
      />

      <ItemListModal
        selectedItem={selectedItem}
        containers={containers}
        categories={categories}
        onSuccess={handleModalSuccess}
        onCancel={handleModalCancel}
      />
    </View>
  );
});

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
    maxHeight: '50%',
  },
  filterSection: {
    marginBottom: 15,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterOptionText: {
    fontSize: 12,
    color: '#333',
  },
  filterOptionTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
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
    backgroundColor: '#fff',
  },
  priceSeparator: {
    color: '#666',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
    padding: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    padding: 8,
  },
  itemRow: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemStatus: {
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  soldStatus: {
    backgroundColor: '#ffebee',
    color: '#c62828',
  },
  availableStatus: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
  },
  skeletonContainer: {
    flex: 1,
    padding: 16,
  },
  skeletonRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'center',
  },
  skeletonName: {
    height: 20,
    flex: 2,
    marginRight: 16,
    borderRadius: 4,
  },
  skeletonPrice: {
    height: 20,
    width: 80,
    marginRight: 16,
    borderRadius: 4,
  },
  skeletonStatus: {
    height: 20,
    width: 100,
    marginRight: 16,
    borderRadius: 4,
  },
  skeletonButton: {
    height: 36,
    width: 120,
    borderRadius: 4,
  },
});

ItemList.displayName = 'ItemList';
ItemRow.displayName = 'ItemRow';
LoadingSkeleton.displayName = 'LoadingSkeleton';

export default withPerformanceMonitoring(ItemList, 'ItemList');