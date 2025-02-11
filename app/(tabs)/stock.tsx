import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { useInventoryData } from '../../src/hooks/useInventoryData';
import { ItemList } from '../../src/components/ItemList';
import { FilterBar } from '../../src/components/FilterBar';
import { handleDatabaseError } from '../../src/utils/errorHandler';

export default function StockScreen() {
  const [filter, setFilter] = useState('');
  const { data: inventoryData, isLoading, error } = useInventoryData();

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

  const filteredItems = inventoryData?.items.filter(item =>
    item.name.toLowerCase().includes(filter.toLowerCase())
  ) || [];

  return (
    <View style={styles.container}>
      <FilterBar
        value={filter}
        onChangeText={setFilter}
        placeholder="Rechercher un article..."
      />
      
      <ItemList
        items={filteredItems}
        containers={inventoryData?.containers || []}
        categories={inventoryData?.categories || []}
        onMarkAsSold={() => {}}
        onMarkAsAvailable={() => {}}
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
