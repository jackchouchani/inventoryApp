import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { Item, Container, Category } from '../database/database';
import { ItemEditForm } from './ItemEditForm';
import { MaterialIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { selectAllCategories } from '../store/categorySlice';
import { selectAllContainers } from '../store/containersSlice';
import { useAnimatedComponents } from '../hooks/useAnimatedComponents';
import ItemCard from './ItemCard';

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

export const ItemList: React.FC<ItemListProps> = ({
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
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!items.length) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Aucun article trouvé</Text>
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
          <Text>Filtres</Text>
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
        data={filteredItems}
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            onPress={() => handleItemPress(item)}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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