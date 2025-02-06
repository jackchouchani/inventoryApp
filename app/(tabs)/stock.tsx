import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { ItemList } from '../../src/components/ItemList';
import { getItems, getContainers, getCategories, updateItemStatus } from '../../src/database/database';
import { setItems } from '../../src/store/itemsSlice';
import { useRefreshStore } from '../../src/store/refreshStore';
import type { Item, Container, Category } from '../../src/database/types';

export default function StockScreen() {
  const [localItems, setLocalItems] = useState<Item[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const dispatch = useDispatch();
  const refreshTimestamp = useRefreshStore(state => state.refreshTimestamp);

  const loadData = async () => {
    try {
      const [loadedItems, loadedContainers, loadedCategories] = await Promise.all([
        getItems(),
        getContainers(),
        getCategories()
      ]);
      setLocalItems(loadedItems);
      setContainers(loadedContainers);
      setCategories(loadedCategories);
      dispatch(setItems(loadedItems));
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTimestamp]);

  const handleMarkAsSold = async (itemId: number) => {
    try {
      await updateItemStatus(itemId, 'sold');
      await loadData();
    } catch (error) {
      console.error('Error marking item as sold:', error);
    }
  };

  const handleMarkAsAvailable = async (itemId: number) => {
    try {
      await updateItemStatus(itemId, 'available');
      await loadData();
    } catch (error) {
      console.error('Error marking item as available:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Stock</Text>
        <ItemList
          items={localItems}
          containers={containers}
          categories={categories}
          onMarkAsSold={handleMarkAsSold}
          onMarkAsAvailable={handleMarkAsAvailable}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#007AFF',
  }
});
