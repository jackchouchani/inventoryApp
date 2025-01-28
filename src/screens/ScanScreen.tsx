import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal, FlatList, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Scanner from '../components/Scanner';
import { Container, Item, updateItem, getContainers, getItems } from '../database/database';
import { useRefreshStore } from '../store/refreshStore';

export const ScanScreen: React.FC = () => {
  const navigation = useNavigation();
  const [showManualMode, setShowManualMode] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const refreshTimestamp = useRefreshStore(state => state.refreshTimestamp);
  const triggerRefresh = useRefreshStore(state => state.triggerRefresh);

  const loadData = async () => {
    try {
      const [loadedContainers, loadedItems] = await Promise.all([
        getContainers(),
        getItems()
      ]);
      setContainers(loadedContainers);
      setItems(loadedItems);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTimestamp]);

  const handleManualAssignment = async (itemId: number) => {
    if (!selectedContainer || !selectedContainer.id) return;
    
    try {
      const item = items.find(i => i.id === itemId);
      if (!item) return;
      
      const updateData = {
        name: item.name,
        purchasePrice: item.purchasePrice,
        sellingPrice: item.sellingPrice,
        status: item.status,
        photoUri: item.photoUri,
        categoryId: item.categoryId,
        containerId: selectedContainer.id,
        qrCode: item.qrCode,
        createdAt: item.createdAt,
        updatedAt: new Date().toISOString()
      };
      
      await updateItem(itemId, updateData);
      triggerRefresh();
    } catch (error) {
      console.error('Erreur lors de l\'assignation:', error);
    }
  };

  const renderItem = ({ item }: { item: Item }) => (
    <TouchableOpacity
      style={[
        styles.itemRow,
        item.containerId === selectedContainer?.id && styles.itemSelected
      ]}
      onPress={() => handleManualAssignment(item.id!)}
    >
      <Text style={styles.itemText}>{item.name}</Text>
      <Text style={styles.itemStatus}>
        {item.containerId === selectedContainer?.id ? '✓' : ''}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.modeButton}
          onPress={() => setShowManualMode(!showManualMode)}
        >
          <Text style={styles.modeButtonText}>
            {showManualMode ? 'Mode Scanner' : 'Mode Manuel'}
          </Text>
        </TouchableOpacity>
      </View>

      {showManualMode ? (
        <View style={styles.manualContainer}>
          <Text style={styles.sectionTitle}>Sélectionner un container:</Text>
          <View style={styles.containerGrid}>
            {containers.map((container: Container) => (
              <TouchableOpacity
                key={container.id}
                style={[
                  styles.containerButton,
                  selectedContainer?.id === container.id && styles.containerSelected
                ]}
                onPress={() => setSelectedContainer(container)}
              >
                <Text style={styles.containerText}>{container.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {selectedContainer && (
            <>
              <Text style={styles.sectionTitle}>
                Articles à assigner à {selectedContainer.name}:
              </Text>
              <FlatList
                data={items.filter(item => item.status === 'available')}
                renderItem={renderItem}
                keyExtractor={item => item.id!.toString()}
                style={styles.itemList}
              />
              <TouchableOpacity 
                style={styles.validateButton}
                onPress={() => {
                  Alert.alert('Succès', 'Changements enregistrés');
                  setSelectedContainer(null);
                  loadData();
                }}
              >
                <Text style={styles.validateButtonText}>Valider les changements</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <Scanner onClose={() => navigation.goBack()} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  modeButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  modeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  manualContainer: {
    flex: 1,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  containerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  containerButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    minWidth: '30%',
    alignItems: 'center',
  },
  containerSelected: {
    backgroundColor: '#e3e3e3',
    borderColor: '#007AFF',
  },
  containerText: {
    fontSize: 16,
  },
  itemList: {
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemSelected: {
    backgroundColor: '#e3e3e3',
  },
  itemText: {
    fontSize: 16,
  },
  itemStatus: {
    color: '#007AFF',
    fontSize: 16,
  },
  validateButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 5,
    margin: 15,
    alignItems: 'center',
  },
  validateButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 