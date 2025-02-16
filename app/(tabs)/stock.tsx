import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Alert, Platform } from 'react-native';
import ItemList from '../../src/components/ItemList';
import { FilterBar } from '../../src/components/FilterBar';
import { database } from '../../src/database/database';
import { useDispatch, useSelector } from 'react-redux';
import { updateItem as updateItemAction } from '../../src/store/itemsActions';
import { useInventoryData } from '../../src/hooks/useInventoryData';
import { selectAllCategories } from '../../src/store/categorySlice';
import { selectAllContainers } from '../../src/store/containersSlice';

export default function StockScreen() {
  const [filter, setFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const [selectedContainer, setSelectedContainer] = useState<number | 'none' | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'available' | 'sold'>('all');
  const [priceRange, setPriceRange] = useState<{ min?: number; max?: number }>({});
  
  const dispatch = useDispatch();
  const categories = useSelector(selectAllCategories);
  const containers = useSelector(selectAllContainers);
  
  const { items, isLoading, error, refetch } = useInventoryData({
    search: filter,
    categoryId: selectedCategory,
    containerId: selectedContainer,
    status: selectedStatus === 'all' ? undefined : selectedStatus,
    minPrice: priceRange.min,
    maxPrice: priceRange.max
  });

  // Charger les données au montage du composant
  useEffect(() => {
    refetch();
  }, []);

  const handleMarkAsSold = useCallback(async (itemId: number) => {
    try {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;

      const now = new Date().toISOString();
      const updateData = {
        ...item,
        status: 'sold' as const,
        soldAt: now,
        updatedAt: now
      };

      // Mise à jour optimiste
      dispatch(updateItemAction(updateData));

      try {
        await database.updateItem(itemId, updateData);
        refetch();
      } catch (error) {
        // Rollback en cas d'erreur
        dispatch(updateItemAction(item));
        console.error('Erreur lors du marquage comme vendu:', error);
        Alert.alert('Erreur', 'Impossible de marquer l\'article comme vendu');
      }
    } catch (error) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', 'Une erreur est survenue');
    }
  }, [items, dispatch, refetch]);

  const handleMarkAsAvailable = useCallback(async (itemId: number) => {
    try {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;

      const now = new Date().toISOString();
      const updateData = {
        ...item,
        status: 'available' as const,
        soldAt: undefined,
        updatedAt: now
      };

      // Mise à jour optimiste
      dispatch(updateItemAction(updateData));

      try {
        await database.updateItem(itemId, updateData);
        refetch();
      } catch (error) {
        // Rollback en cas d'erreur
        dispatch(updateItemAction(item));
        console.error('Erreur lors de la remise en stock:', error);
        Alert.alert('Erreur', 'Impossible de remettre l\'article en stock');
      }
    } catch (error) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', 'Une erreur est survenue');
    }
  }, [items, dispatch, refetch]);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Une erreur est survenue lors du chargement des articles</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FilterBar
        value={filter}
        onChangeText={setFilter}
        placeholder="Rechercher un article..."
        onCategoryChange={setSelectedCategory}
        onContainerChange={setSelectedContainer}
        onStatusChange={setSelectedStatus}
        onPriceChange={(min, max) => setPriceRange({ min, max })}
      />
      
      <ItemList
        items={items}
        onMarkAsSold={handleMarkAsSold}
        onMarkAsAvailable={handleMarkAsAvailable}
        isLoading={isLoading}
      />
    </View>
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
