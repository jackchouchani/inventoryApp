import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import ItemList from '../../src/components/ItemList';
import { FilterBar } from '../../src/components/FilterBar';
import { useSelector } from 'react-redux';
import { useInventoryData } from '../../src/hooks/useInventoryData';
import { selectAllCategories } from '../../src/store/categorySlice';
import { selectAllContainers } from '../../src/store/containersSlice';
import { useStockActions } from '../../src/hooks/useStockActions';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import type { Item } from '../../src/types/item';
import type { Container } from '../../src/types/container';
import type { Category } from '../../src/types/category';

interface StockFilters {
  search?: string;
  categoryId?: number;
  containerId?: number | 'none';
  status?: 'all' | 'available' | 'sold';
  minPrice?: number;
  maxPrice?: number;
}

interface StockData {
  items: Item[];
  categories: Category[];
  containers: Container[];
}

export default function StockScreen() {
  const [filter, setFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const [selectedContainer, setSelectedContainer] = useState<number | 'none' | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'available' | 'sold'>('all');
  const [priceRange, setPriceRange] = useState<{ min?: number; max?: number }>({});
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  
  const categories = useSelector(selectAllCategories);
  const containers = useSelector(selectAllContainers);
  const { handleMarkAsSold, handleMarkAsAvailable } = useStockActions();
  
  const { data, isLoading, error, refetch } = useInventoryData({
    search: filter,
    categoryId: selectedCategory,
    containerId: selectedContainer,
    status: selectedStatus === 'all' ? undefined : selectedStatus,
    minPrice: priceRange.min,
    maxPrice: priceRange.max
  } as StockFilters);

  const items = (data as StockData)?.items || [];

  const handleItemPress = useCallback((item: Item) => {
    setSelectedItem(item);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setSelectedItem(null);
    refetch();
  }, [refetch]);

  const handleEditCancel = useCallback(() => {
    setSelectedItem(null);
  }, []);

  if (error) {
    return (
      <ErrorBoundary>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Une erreur est survenue lors du chargement des articles</Text>
        </View>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <FilterBar
          value={filter}
          onChangeText={setFilter}
          placeholder="Rechercher un article..."
          onCategoryChange={setSelectedCategory}
          onContainerChange={setSelectedContainer}
          onStatusChange={setSelectedStatus}
          onPriceChange={(min: number | undefined, max: number | undefined) => setPriceRange({ min, max })}
        />
        
        <ItemList
          items={items}
          onItemPress={handleItemPress}
          onMarkAsSold={handleMarkAsSold}
          onMarkAsAvailable={handleMarkAsAvailable}
          isLoading={isLoading}
          categories={categories}
          containers={containers}
          selectedItem={selectedItem}
          onEditSuccess={handleEditSuccess}
          onEditCancel={handleEditCancel}
        />
      </View>
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
});
