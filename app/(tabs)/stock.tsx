import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Alert } from 'react-native';
import { useInventoryData } from '../../src/hooks/useInventoryData';
import { ItemList } from '../../src/components/ItemList';
import { FilterBar } from '../../src/components/FilterBar';
import { handleDatabaseError } from '../../src/utils/errorHandler';
import { updateItem, Item } from '../../src/database/database';
import { useDispatch, useSelector } from 'react-redux';
import { updateItem as updateItemAction, selectAllItems } from '../../src/store/itemsSlice';
import { PostgrestError } from '@supabase/supabase-js';
import { RootState } from '../../src/store/store';
import supabaseDatabase from '../../src/database/supabaseDatabase';

export default function StockScreen() {
  const [filter, setFilter] = useState('');
  const dispatch = useDispatch();
  const items = useSelector(selectAllItems);

  const { isLoading, error, refetch } = useInventoryData({
    search: filter
  });

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const items = await supabaseDatabase.getItems();
        if (items) {
          dispatch({ type: 'items/setItems', payload: items });
        }
      } catch (error) {
        console.error('Erreur lors du chargement initial des items:', error);
      }
    };

    // Charger les données si le tableau d'items est vide
    if (!items || items.length === 0) {
      loadInitialData();
    }
  }, [dispatch, items]);

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

      dispatch(updateItemAction(updateData));

      try {
        await updateItem(itemId, updateData);
        refetch();
      } catch (error) {
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

      dispatch(updateItemAction(updateData));

      try {
        await updateItem(itemId, updateData);
        refetch();
      } catch (error) {
        dispatch(updateItemAction(item));
        console.error('Erreur lors de la remise en stock:', error);
        Alert.alert('Erreur', 'Impossible de remettre l\'article en stock');
      }
    } catch (error) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', 'Une erreur est survenue');
    }
  }, [items, dispatch, refetch]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Chargement de l'inventaire...</Text>
      </View>
    );
  }

  if (error) {
    console.error('Erreur lors du chargement des données:', error);
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          Une erreur est survenue lors du chargement des données
        </Text>
      </View>
    );
  }

  const filteredItems = (items || []).filter((item: Item) =>
    item.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <FilterBar
        value={filter}
        onChangeText={setFilter}
        placeholder="Rechercher un article..."
      />
      
      <ItemList
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
