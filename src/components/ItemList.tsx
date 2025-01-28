import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { Item, Container, Category } from '../database/database';
import { useRefreshStore } from '../store/refreshStore';

interface ItemListProps {
  items: Item[];
  containers: Container[];
  categories: Category[];
  onMarkAsSold: (itemId: number) => void;
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

export const ItemList: React.FC<ItemListProps> = ({ items, containers, categories, onMarkAsSold, onMoveItem }) => {
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

  const handleMarkAsSold = async (itemId: number) => {
    await onMarkAsSold(itemId);
    triggerRefresh();
  };

  const filteredItems = items.filter((item) => {
    // Text search
    if (
      filters.search &&
      !item.name.toLowerCase().includes(filters.search.toLowerCase())
    ) {
      return false;
    }

    // Category filter
    if (filters.categoryId && item.categoryId !== filters.categoryId) {
      return false;
    }

    // Container filter
    if (filters.containerId && item.containerId !== filters.containerId) {
      return false;
    }

    // Status filter
    if (filters.status !== 'all' && item.status !== filters.status) {
      return false;
    }

    // Price range filter
    const minPrice = parseFloat(filters.minPrice);
    const maxPrice = parseFloat(filters.maxPrice);

    if (!isNaN(minPrice) && item.sellingPrice < minPrice) {
      return false;
    }

    if (!isNaN(maxPrice) && item.sellingPrice > maxPrice) {
      return false;
    }

    return true;
  });

  const renderItem = ({ item }: { item: Item }) => (
    <View style={styles.itemCard}>
      <Image source={{ uri: item.photoUri }} style={styles.itemImage} />
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text>Purchase: ${item.purchasePrice}</Text>
        <Text>Selling: ${item.sellingPrice}</Text>
        <Text>Status: {item.status}</Text>
        {onMoveItem && (
          <View style={styles.containerPicker}>
            <Text style={styles.containerLabel}>Move to:</Text>
            <View style={styles.containerOptions}>
              {containers.map((container) => (
                <TouchableOpacity
                  key={container.id}
                  style={[styles.containerOption, item.containerId === container.id && styles.containerOptionSelected]}
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
      {item.status === 'available' && (
        <TouchableOpacity
          style={styles.soldButton}
          onPress={() => handleMarkAsSold(item.id!)}
        >
          <Text style={styles.soldButtonText}>Mark as Sold</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          value={filters.search}
          onChangeText={(text) => setFilters({ ...filters, search: text })}
        />
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Text>Filters</Text>
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filtersContainer}>
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Category</Text>
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
            <Text style={styles.filterLabel}>Status</Text>
            <View style={styles.filterOptions}>
              {['all', 'available', 'sold'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterOption,
                    filters.status === status && styles.filterOptionSelected,
                  ]}
                  onPress={() =>
                    setFilters({ ...filters, status: status as Filters['status'] })
                  }
                >
                  <Text>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
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
    borderBottomColor: '#ddd',
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
  soldButton: {
    backgroundColor: '#007AFF',
    padding: 8,
    borderRadius: 5,
    justifyContent: 'center',
  },
  soldButtonText: {
    color: '#fff',
    fontSize: 14,
  },
});