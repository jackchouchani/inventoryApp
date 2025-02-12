import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Alert } from 'react-native';
import { ItemList } from '../../src/components/ItemList';
import { FilterBar } from '../../src/components/FilterBar';
import { updateItem, Item } from '../../src/database/database';
import { useDispatch } from 'react-redux';
import { updateItem as updateItemAction } from '../../src/store/itemsSlice';
import { useInventoryData } from '../../src/hooks/useInventoryData';

export default function StockScreen() {
  const [filter, setFilter] = useState('');
  const dispatch = useDispatch();
  const { items, isLoading, error, refetch } = useInventoryData({
    search: filter
  });

  const handleMarkAsSold = useCallback(async (itemId: number) => {
    try {
      const item = items.find((i: Item) => i.id === itemId);
      if (!item) return;

      const updateData: Item = {
        ...item,
        status: 'sold' as const,
        soldAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Mise à jour optimiste
      dispatch(updateItemAction(updateData));

      try {
        await updateItem(itemId, updateData);
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
      const item = items.find((i: Item) => i.id === itemId);
      if (!item) return;

      const updateData: Item = {
        ...item,
        status: 'available' as const,
        soldAt: null,
        updatedAt: new Date().toISOString()
      };

      // Mise à jour optimiste
      dispatch(updateItemAction(updateData));

      try {
        await updateItem(itemId, updateData);
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
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
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
