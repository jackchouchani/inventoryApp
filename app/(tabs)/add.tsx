import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { useRouter } from 'expo-router';
import { getContainers, getCategories, getItems } from '../../src/database/database';
import { setItems } from '../../src/store/itemsSlice';
import ItemForm from '../../src/components/ItemForm';
import { useRefreshStore } from '../../src/store/refreshStore';
import { Container, Category } from '../../src/database/types';

export default function AddScreen() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Ajouter un article</Text>
        <ItemForm 
          containers={containers} 
          categories={categories}
          onSuccess={() => router.push('/(tabs)/stock')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  }
});
