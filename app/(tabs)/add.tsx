import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { useDispatch } from 'react-redux';
import { useRouter } from 'expo-router';
import { getContainers, getCategories, getItems } from '../../src/database/database';
import { setItems } from '../../src/store/itemsSlice';
import ItemForm from '../../src/components/ItemForm';
import { useRefreshStore } from '../../src/store/refreshStore';
import { Container } from '../../src/database/types';

export default function Add() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [categories, setCategories] = useState([]);
  const refreshTimestamp = useRefreshStore(state => state.refreshTimestamp);
  const dispatch = useDispatch();
  const router = useRouter();

  const loadData = async () => {
    try {
      const [loadedContainers, loadedCategories] = await Promise.all([
        getContainers(),
        getCategories()
      ]);
      setContainers(loadedContainers);
      setCategories(loadedCategories);
      dispatch(setItems(await getItems()));
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTimestamp]);

  return (
    <View style={{ flex: 1 }}>
      <ItemForm 
        containers={containers} 
        categories={categories}
        onSuccess={() => router.push('/(tabs)/stock')}
      />
    </View>
  );
}
