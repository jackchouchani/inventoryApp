import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { useDispatch } from 'react-redux';
import { ItemList } from '../../src/components/ItemList';
import { getItems, getContainers, getCategories, updateItem } from '../../src/database/database';
import { setItems } from '../../src/store/itemsSlice';

export default function Stock() {
  const [localItems, setLocalItems] = useState([]);
  const [containers, setContainers] = useState([]);
  const [categories, setCategories] = useState([]);
  const dispatch = useDispatch();

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
  }, []);

  const handleMarkAsSold = async (itemId) => {
    try {
      await updateItem(itemId, { status: 'sold' });
      await loadData();
    } catch (error) {
      console.error('Error marking item as sold:', error);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ItemList
        items={localItems}
        containers={containers}
        categories={categories}
        onMarkAsSold={handleMarkAsSold}
      />
    </View>
  );
} 