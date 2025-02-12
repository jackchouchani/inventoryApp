import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal, FlatList, Alert, TextInput, SafeAreaView, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Scanner } from '../../src/components/Scanner';
import { Container, Item, updateItem, getContainers, getItems } from '../../src/database/database';
import { useRefreshStore } from '../../src/store/refreshStore';
import { MaterialIcons } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import { updateItem as updateItemAction } from '../../src/store/itemsSlice';

interface ItemProps {
  item: Item;
}

const ScanScreen: React.FC = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const dispatch = useDispatch();

  // 1. États
  const [showManualMode, setShowManualMode] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [showOtherContainers, setShowOtherContainers] = useState(false);
  const [isScannerActive, setIsScannerActive] = useState(true);
  const [scanMode, setScanMode] = useState<'container' | 'item'>('container');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignmentProgress, setAssignmentProgress] = useState<{
    itemId: number;
    status: 'pending' | 'success' | 'error'
  }>({
    itemId: 0,
    status: 'pending'
  });
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);

  // 2. Store hooks
  const refreshTimestamp = useRefreshStore(state => state.refreshTimestamp);
  const triggerRefresh = useRefreshStore(state => state.triggerRefresh);

  // 3. Effets
  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      setIsScannerActive(false);
      setShowManualMode(false);
    });

    return () => {
      unsubscribe();
      setIsScannerActive(false);
      setShowManualMode(false);
    };
  }, [navigation]);

  useEffect(() => {
    setIsScannerActive(true);
  }, [showManualMode]);

  // 4. Chargement des données
  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [loadedContainers, loadedItems] = await Promise.all([
        getContainers(),
        getItems()
      ]);
      setContainers(loadedContainers || []);
      setItems(loadedItems || []);
    } catch (error) {
      setError("Erreur lors du chargement des données");
      console.error('Erreur lors du chargement des données:', error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [refreshTimestamp, loadData]);

  // 5. Logique de filtrage
  useEffect(() => {
    const filtered = items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (showOnlySelected) {
        return matchesSearch && item.containerId === selectedContainer?.id;
      }
      
      if (showOtherContainers) {
        return matchesSearch;
      }
      
      return matchesSearch && (item.containerId === null || item.containerId === selectedContainer?.id);
    });
    
    setFilteredItems(filtered);
  }, [items, searchQuery, showOnlySelected, showOtherContainers, selectedContainer]);

  // 6. Callbacks
  const handleManualAssignment = useCallback(async (itemId: number) => {
    if (!selectedContainer) return;
    
    try {
      setIsAssigning(true);
      setAssignmentProgress({ itemId, status: 'pending' });
      
      const updatedItems = [...items];
      const itemIndex = updatedItems.findIndex(i => i.id === itemId);
      if (itemIndex === -1) return;
      
      const item = updatedItems[itemIndex];
      const updateData = {
        ...item,
        containerId: item.containerId === selectedContainer.id ? null : selectedContainer.id,
        updatedAt: new Date().toISOString()
      };
      
      updatedItems[itemIndex] = updateData;
      setItems(updatedItems);
      dispatch(updateItemAction(updateData));
      
      await updateItem(itemId, updateData);
      
      setAssignmentProgress({ itemId, status: 'success' });
      
      Alert.alert(
        'Succès',
        `Article ${item.name} ${item.containerId === selectedContainer.id ? 'retiré du' : 'ajouté au'} container ${selectedContainer.name}`
      );
    } catch (error) {
      console.error('Erreur lors de l\'assignation:', error);
      setAssignmentProgress({ itemId, status: 'error' });
      await loadData();
      Alert.alert('Erreur', 'Impossible d\'assigner l\'article');
    } finally {
      setIsAssigning(false);
      setTimeout(() => {
        setAssignmentProgress({ itemId: 0, status: 'pending' });
      }, 2000);
    }
  }, [selectedContainer, items, dispatch, loadData]);

  const handleScanResult = useCallback(async (result: { success: boolean; message: string; type?: 'container' | 'item'; data?: any }) => {
    if (result.success) {
      if (result.type === 'container') {
        setScanMode('item');
        const container = containers.find(c => c.qrCode === result.data?.qrCode);
        if (container) {
          setSelectedContainer(container);
        }
      } else if (result.type === 'item' && selectedContainer) {
        try {
          const updatedItems = [...items];
          const itemIndex = updatedItems.findIndex(i => i.qrCode === result.data?.qrCode);
          if (itemIndex === -1) return;

          const item = updatedItems[itemIndex];
          const updateData = {
            ...item,
            containerId: selectedContainer.id,
            updatedAt: new Date().toISOString()
          };

          updatedItems[itemIndex] = updateData;
          setItems(updatedItems);
          dispatch(updateItemAction(updateData));

          await updateItem(item.id!, updateData);

          Alert.alert(
            'Succès',
            `Article ${item.name} assigné au container ${selectedContainer.name}`
          );
        } catch (error) {
          console.error('Erreur lors du scan:', error);
          await loadData();
          Alert.alert('Erreur', 'Impossible de scanner l\'article. Veuillez réessayer.');
        }
      }
    }
    setTimeout(() => setIsScannerActive(true), 1500);
  }, [containers, items, selectedContainer, dispatch, loadData]);

  const renderItem = ({ item }: { item: Item }) => (
    <TouchableOpacity
      style={[
        styles.itemRow,
        item.containerId === selectedContainer?.id && styles.itemSelected,
        item.containerId !== null && 
        item.containerId !== selectedContainer?.id && 
        styles.itemInOtherContainer,
        assignmentProgress.itemId === item.id && 
        assignmentProgress.status === 'pending' && 
        styles.itemLoading
      ]}
      onPress={() => handleManualAssignment(item.id!)}
      disabled={isAssigning || !selectedContainer}
    >
      <View style={styles.itemContent}>
        <View>
          <Text style={styles.itemText}>{item.name}</Text>
          {item.containerId !== null && 
           item.containerId !== selectedContainer?.id && (
            <Text style={styles.containerInfo}>
              Dans: {containers.find(c => c.id === item.containerId)?.name}
            </Text>
          )}
        </View>
        <View style={styles.itemStatus}>
          {assignmentProgress.itemId === item.id ? (
            assignmentProgress.status === 'pending' ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : assignmentProgress.status === 'success' ? (
              <MaterialIcons name="check-circle" size={24} color="#4CAF50" />
            ) : (
              <MaterialIcons name="error" size={24} color="#FF3B30" />
            )
          ) : (
            item.containerId === selectedContainer?.id && (
              <MaterialIcons name="check" size={24} color="#4CAF50" />
            )
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.modeButton}
            onPress={() => {
              setShowManualMode(!showManualMode);
              setSelectedContainer(null);
              setScanMode('container');
            }}
          >
            <MaterialIcons 
              name={showManualMode ? "qr-code-scanner" : "edit"} 
              size={24} 
              color="#fff" 
            />
            <Text style={styles.modeButtonText}>
              {showManualMode ? 'Mode Scanner' : 'Mode Manuel'}
            </Text>
          </TouchableOpacity>
        </View>

        {showManualMode ? (
          <View style={styles.manualContainer}>
            <ScrollView>
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
                
                  <View style={styles.searchContainer}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Rechercher un article..."
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                  </View>

                  <View style={styles.filterContainer}>
                    <TouchableOpacity
                      style={[styles.filterButton, showOnlySelected && styles.filterButtonActive]}
                      onPress={() => setShowOnlySelected(!showOnlySelected)}
                    >
                      <Text style={[styles.filterButtonText, showOnlySelected && styles.filterButtonTextActive]}>
                        Articles assignés
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.filterButton, showOtherContainers && styles.filterButtonActive]}
                      onPress={() => setShowOtherContainers(!showOtherContainers)}
                    >
                      <Text style={[styles.filterButtonText, showOtherContainers && styles.filterButtonTextActive]}>
                        Tous les articles
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>

            {selectedContainer && (
              <FlatList
                data={filteredItems}
                renderItem={renderItem}
                keyExtractor={item => item.id!.toString()}
                style={styles.itemList}
              />
            )}
          </View>
        ) : (
          <View style={styles.scannerContainer}>
            <Scanner 
              onClose={() => router.back()} 
              isActive={isScannerActive}
              onScan={handleScanResult}
            />
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    zIndex: 1,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  modeButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  manualContainer: {
    flex: 1,
    padding: 15,
    backgroundColor: '#f5f5f5',
  },
  errorContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
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
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
  searchContainer: {
    marginVertical: 10,
    paddingHorizontal: 5,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 10,
  },
  filterButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    color: '#007AFF',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  itemInOtherContainer: {
    backgroundColor: '#fff3e0',
  },
  containerInfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  itemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
  },
  itemLoading: {
    opacity: 0.7,
  },
});

export default ScanScreen; 