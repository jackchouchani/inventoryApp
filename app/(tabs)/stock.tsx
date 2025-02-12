import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Alert } from 'react-native';
import { useInventoryData } from '../../src/hooks/useInventoryData';
import { ItemList } from '../../src/components/ItemList';
import { FilterBar } from '../../src/components/FilterBar';
import { handleDatabaseError } from '../../src/utils/errorHandler';
import { updateItem, Item } from '../../src/database/database';
import { useDispatch, useSelector } from 'react-redux';
import { updateItem as updateItemAction } from '../../src/store/itemsSlice';
import { PostgrestError } from '@supabase/supabase-js';
import { RootState } from '../../src/store/store';

export default function StockScreen() {
  const [filter, setFilter] = useState('');
  const { isLoading, error } = useInventoryData();
  const dispatch = useDispatch();
  const items = useSelector((state: RootState) => state.items.items);

  const handleMarkAsSold = useCallback(async (itemId: number) => {
    try {
      const item = items.find(i => i.id === itemId);
      if (!item) return;

      const updateData: Item = {
        ...item,
        status: 'sold' as const,
        soldAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Mise à jour optimiste du store Redux
      dispatch(updateItemAction(updateData));

      try {
        // Mise à jour de la base de données en arrière-plan
        await updateItem(itemId, updateData);
      } catch (error) {
        // En cas d'erreur, on revient à l'état précédent
        dispatch(updateItemAction(item));
        console.error('Erreur lors du marquage comme vendu:', error);
        Alert.alert('Erreur', 'Impossible de marquer l\'article comme vendu');
        handleDatabaseError(error as Error | PostgrestError, 'StockScreen.handleMarkAsSold');
      }
    } catch (error) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', 'Une erreur est survenue');
    }
  }, [items, dispatch]);

  const handleMarkAsAvailable = useCallback(async (itemId: number) => {
    try {
      const item = items.find(i => i.id === itemId);
      if (!item) return;

      const updateData: Item = {
        ...item,
        status: 'available' as const,
        soldAt: null,
        updatedAt: new Date().toISOString()
      };

      // Mise à jour optimiste du store Redux
      dispatch(updateItemAction(updateData));

      try {
        // Mise à jour de la base de données en arrière-plan
        await updateItem(itemId, updateData);
      } catch (error) {
        // En cas d'erreur, on revient à l'état précédent
        dispatch(updateItemAction(item));
        console.error('Erreur lors de la remise en stock:', error);
        Alert.alert('Erreur', 'Impossible de remettre l\'article en stock');
        handleDatabaseError(error as Error | PostgrestError, 'StockScreen.handleMarkAsAvailable');
      }
    } catch (error) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', 'Une erreur est survenue');
    }
  }, [items, dispatch]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Chargement de l'inventaire...</Text>
      </View>
    );
  }

  if (error) {
    handleDatabaseError(error, 'StockScreen');
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          Une erreur est survenue lors du chargement des données
        </Text>
      </View>
    );
  }

  const filteredItems = items.filter(item =>
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
        items={filteredItems}
        containers={[]} // Ces valeurs seront fournies par le composant parent
        categories={[]} // Ces valeurs seront fournies par le composant parent
        onMarkAsSold={handleMarkAsSold}
        onMarkAsAvailable={handleMarkAsAvailable}
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
