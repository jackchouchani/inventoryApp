import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, Image, Modal } from 'react-native';
import { Item, Container, Category } from '../database/database';
import { useRefreshStore } from '../store/refreshStore';
import { ItemEditForm } from './ItemEditForm';

interface ItemListProps {
  items: Item[];
  containers: Container[];
  categories: Category[];
  onMarkAsSold: (itemId: number) => void;
  onMarkAsAvailable: (itemId: number) => void;
  onMoveItem?: (itemId: number, newContainerId: number) => void;
}

interface Filters {
  search: string;
  categoryId: number | null;
  containerId: 'none' | number | null;
  status: 'all' | 'available' | 'sold';
  minPrice: string;
  maxPrice: string;
}

export const ItemList: React.FC<ItemListProps> = ({ items, containers, categories, onMarkAsSold, onMarkAsAvailable, onMoveItem }) => {
  const [filters, setFilters] = useState<Filters>({
    search: '',
    categoryId: null,
    containerId: null,
    status: 'all',
    minPrice: '',
    maxPrice: '',
  });

  const [showFilters, setShowFilters] = useState(false);

  const triggerRefresh = useRefreshStore(state => state.triggerRefresh);
  const refreshTimestamp = useRefreshStore(state => state.refreshTimestamp);

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  useEffect(() => {
    // Le composant se rafraîchira automatiquement quand refreshTimestamp change
  }, [refreshTimestamp, items]);

  const handleStatusToggle = async (itemId: number, currentStatus: string) => {
    if (currentStatus === 'available') {
      await onMarkAsSold(itemId);
    } else {
      await onMarkAsAvailable(itemId);
    }
    triggerRefresh();
  };

  const filteredItems = items.filter((item: Item) => {
    const searchLower = filters.search.toLowerCase();
    const matchesSearch = 
      item.name.toLowerCase().includes(searchLower) ||
      (item.description && item.description.toLowerCase().includes(searchLower));

    const matchesCategory = !filters.categoryId || item.categoryId === filters.categoryId;
    const matchesContainer = 
      !filters.containerId ? true : 
      filters.containerId === 'none' ? !item.containerId :
      item.containerId === filters.containerId;
    const matchesStatus = filters.status === 'all' || item.status === filters.status;
    
    const minPrice = parseFloat(filters.minPrice);
    const maxPrice = parseFloat(filters.maxPrice);
    const matchesPrice = 
      (!minPrice || item.sellingPrice >= minPrice) &&
      (!maxPrice || item.sellingPrice <= maxPrice);

    return matchesSearch && matchesCategory && matchesContainer && 
           matchesStatus && matchesPrice;
  });

  const renderItem = ({ item }: { item: Item }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => setSelectedItem(item)}
    >
      <Image source={{ uri: item.photoUri }} style={styles.itemImage} />
      <View style={styles.itemContent}>
        <Text style={styles.itemName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.itemDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.priceContainer}>
          <View>
            <Text style={styles.priceLabel}>Prix d'achat</Text>
            <Text style={styles.priceValue}>{item.purchasePrice}€</Text>
          </View>
          <View>
            <Text style={styles.priceLabel}>Prix de vente</Text>
            <Text style={styles.priceValue}>{item.sellingPrice}€</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.statusButton,
            item.status === 'available' ? styles.soldButton : styles.availableButton
          ]}
          onPress={() => handleStatusToggle(item.id!, item.status)}
        >
          <Text style={styles.statusButtonText}>
            {item.status === 'available' ? 'Marquer comme vendu' : 'Marquer comme disponible'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const handleEditSuccess = () => {
    setSelectedItem(null);
    triggerRefresh();
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher des articles..."
          value={filters.search}
          onChangeText={(text) => setFilters({ ...filters, search: text })}
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
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.filterOption,
                    filters.categoryId === category.id && styles.filterOptionSelected,
                  ]}
                  onPress={() =>
                    setFilters({
                      ...filters,
                      categoryId: filters.categoryId === category.id ? null : category.id ?? null,
                    })
                  }
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
                onPress={() =>
                  setFilters({
                    ...filters,
                    containerId: filters.containerId === 'none' ? null : 'none',
                  })
                }
              >
                <Text style={styles.filterOptionText}>Sans container</Text>
              </TouchableOpacity>
              {containers.map((container) => (
                <TouchableOpacity
                  key={container.id}
                  style={[
                    styles.filterOption,
                    filters.containerId === container.id &&
                      styles.filterOptionSelected,
                  ]}
                  onPress={() =>
                    setFilters({
                      ...filters,
                        containerId: filters.containerId === container.id ? null : container.id ?? null,
                    })
                  }
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
                  onPress={() => setFilters({ 
                    ...filters, 
                    status: status.value as Filters['status'] 
                  })}
                >
                  <Text style={styles.filterOptionText}>{status.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Price Range</Text>
            <View style={styles.priceInputs}>
              <TextInput
                style={styles.priceInput}
                placeholder="Min"
                value={filters.minPrice}
                onChangeText={(text) => setFilters({ ...filters, minPrice: text })}
                keyboardType="numeric"
              />
              <Text>-</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="Max"
                value={filters.maxPrice}
                onChangeText={(text) => setFilters({ ...filters, maxPrice: text })}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>
      )}

      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id!.toString()}
        style={styles.list}
      />

      <Modal
        visible={!!selectedItem}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedItem(null)}
      >
        {selectedItem && (
          <View style={styles.modalOverlay}>
            <ItemEditForm
              item={selectedItem}
              containers={containers}
              categories={categories}
              onSuccess={handleEditSuccess}
              onCancel={() => setSelectedItem(null)}
            />
          </View>
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchBar: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  searchInput: {
    flex: 1,
    height: 36,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  filterButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  filtersContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  filterSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000',
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
  },
  filterOptionSelected: {
    backgroundColor: '#007AFF',
  },
  filterOptionText: {
    color: '#000',
    fontSize: 14,
  },
  filterOptionTextSelected: {
    color: '#fff',
  },
  itemCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  itemContent: {
    padding: 16,
  },
  itemImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
  },
  itemInfo: {
    marginTop: 12,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000',
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  statusButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  soldButton: {
    backgroundColor: '#FF3B30',
  },
  availableButton: {
    backgroundColor: '#34C759',
  },
  statusButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  priceInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceInput: {
    width: 100,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    marginHorizontal: 5,
  },
  list: {
    flex: 1,
  },
});