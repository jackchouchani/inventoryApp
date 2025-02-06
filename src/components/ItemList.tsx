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
  containerId: number | null;
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

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

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
    const matchesContainer = !filters.containerId || item.containerId === filters.containerId;
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
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.itemDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <Text>Prix d'achat: {item.purchasePrice}€</Text>
        <Text>Prix de vente: {item.sellingPrice}€</Text>
        <Text>État: {item.status === 'available' ? 'Disponible' : 'Vendu'}</Text>
        {onMoveItem && (
          <View style={styles.containerPicker}>
            <Text style={styles.containerLabel}>Déplacer vers:</Text>
            <View style={styles.containerOptions}>
              {containers.map((container) => (
                <TouchableOpacity
                  key={container.id}
                  style={[
                    styles.containerOption,
                    item.containerId === container.id && styles.containerOptionSelected
                  ]}
                  onPress={() => onMoveItem && onMoveItem(item.id!, container.id!)}
                  disabled={item.containerId === container.id}
                >
                  <Text>{container.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
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
                  <Text>{category.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Container</Text>
            <View style={styles.filterOptions}>
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
                  <Text>{container.name}</Text>
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
                  <Text>{status.label}</Text>
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
    backgroundColor: '#fff',
  },
  searchBar: {
    flexDirection: 'row',
    padding: 10,
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
    marginRight: 10,
  },
  filterButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
  },
  filtersContainer: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  filterSection: {
    marginBottom: 15,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterOption: {
    padding: 8,
    margin: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
  },
  filterOptionSelected: {
    backgroundColor: '#e3e3e3',
  },
  containerPicker: {
    marginTop: 10,
  },
  containerLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  containerOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  containerOption: {
    padding: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 3,
    marginRight: 5,
    marginBottom: 5,
  },
  containerOptionSelected: {
    backgroundColor: '#e3e3e3',
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
  itemCard: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd'
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 5,
    marginRight: 10,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statusButton: { 
    padding: 8,
    borderRadius: 5,
    justifyContent: 'center',
  },
  soldButton: {
    backgroundColor: '#f54251',
  },
  availableButton: {
    backgroundColor: '#34C759',
  },
  statusButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});