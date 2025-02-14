import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { useRouter } from 'expo-router';
import { database } from '../../src/database/database';
import { setItems } from '../../src/store/itemsActions';
import ItemForm from '../../src/components/ItemForm';
import { useRefreshStore } from '../../src/store/refreshStore';
import { Container } from '../../src/types/container';
import { Category } from '../../src/types/category';

export default function AddScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const refreshTimestamp = useRefreshStore(state => state.refreshTimestamp);
  const dispatch = useDispatch();
  const router = useRouter();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [loadedContainers, loadedCategories] = await Promise.all([
        database.getContainers(),
        database.getCategories()
      ]);
      setContainers(loadedContainers || []);
      setCategories(loadedCategories || []);
      const items = await database.getItems();
      dispatch(setItems(items || []));
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    loadData();
  }, [refreshTimestamp, loadData]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
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
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#FF3B30',
    textAlign: 'center',
    fontSize: 16,
  },
});
