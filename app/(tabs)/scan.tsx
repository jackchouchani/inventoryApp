import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal, FlatList, Alert, TextInput, SafeAreaView, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Scanner } from '../../src/components/Scanner';
import { Container, Item, updateItem, getContainers, getItems } from '../../src/database/database';
import { useRefreshStore } from '../../src/store/refreshStore';
import { MaterialIcons } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import { updateItem as updateItemAction } from '../../src/store/itemsSlice';
import { useQueryClient } from '@tanstack/react-query';
import { useInventoryData } from '../../src/hooks/useInventoryData';

interface ScanScreenState {
  mode: 'manual' | 'scanner';
  selectedContainer: Container | null;
  searchQuery: string;
  showOnlySelected: boolean;
  showOtherContainers: boolean;
  isScannerActive: boolean;
  scanMode: 'container' | 'item';
  isAssigning: boolean;
  assignmentProgress: {
    itemId: number;
    status: 'pending' | 'success' | 'error';
  };
}

const INITIAL_STATE: ScanScreenState = {
  mode: 'scanner',
  selectedContainer: null,
  searchQuery: '',
  showOnlySelected: false,
  showOtherContainers: false,
  isScannerActive: true,
  scanMode: 'container',
  isAssigning: false,
  assignmentProgress: {
    itemId: 0,
    status: 'pending'
  }
};

const ScanScreen: React.FC = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const [scanState, setScanState] = useState<ScanScreenState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const triggerRefresh = useRefreshStore(state => state.triggerRefresh);

  // Utilisation de useInventoryData pour gérer les données
  const { items, containers, isLoading, refetch } = useInventoryData();

  // Gestion des filtres
  const filteredItems = useCallback(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(scanState.searchQuery.toLowerCase());
      
      if (scanState.showOnlySelected) {
        return matchesSearch && item.containerId === scanState.selectedContainer?.id;
      }
      
      if (scanState.showOtherContainers) {
        return matchesSearch;
      }
      
      return matchesSearch && (item.containerId === null || item.containerId === scanState.selectedContainer?.id);
    });
  }, [items, scanState.searchQuery, scanState.showOnlySelected, scanState.showOtherContainers, scanState.selectedContainer]);

  // Gestion de la navigation
  useEffect(() => {
    const unsubscribeBlur = navigation.addListener('blur', () => {
      setScanState(prev => ({
        ...prev,
        isScannerActive: false,
        mode: 'scanner'
      }));
    });

    const unsubscribeFocus = navigation.addListener('focus', () => {
      setScanState(prev => ({
        ...prev,
        isScannerActive: true
      }));
    });

    return () => {
      unsubscribeBlur();
      unsubscribeFocus();
    };
  }, [navigation]);

  // Gestion de l'assignation manuelle
  const handleManualAssignment = useCallback(async (itemId: number) => {
    if (!scanState.selectedContainer) return;
    
    try {
      setScanState(prev => ({
        ...prev,
        isAssigning: true,
        assignmentProgress: { itemId, status: 'pending' }
      }));
      
      const item = items.find(i => i.id === itemId);
      if (!item) return;
      
      const updateData = {
        ...item,
        containerId: item.containerId === scanState.selectedContainer.id ? null : scanState.selectedContainer.id,
        updatedAt: new Date().toISOString()
      };
      
      // Mise à jour optimiste
      dispatch(updateItemAction(updateData));
      
      // Mise à jour de la base de données
      await updateItem(itemId, updateData);
      
      // Invalider les requêtes
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      
      setScanState(prev => ({
        ...prev,
        assignmentProgress: { itemId, status: 'success' }
      }));
      
      Alert.alert(
        'Succès',
        `Article ${item.name} ${item.containerId === scanState.selectedContainer.id ? 'retiré du' : 'ajouté au'} container ${scanState.selectedContainer.name}`
      );
    } catch (error) {
      console.error('Erreur lors de l\'assignation:', error);
      setScanState(prev => ({
        ...prev,
        assignmentProgress: { itemId, status: 'error' }
      }));
      await refetch();
      Alert.alert('Erreur', 'Impossible d\'assigner l\'article');
    } finally {
      setScanState(prev => ({
        ...prev,
        isAssigning: false
      }));
      setTimeout(() => {
        setScanState(prev => ({
          ...prev,
          assignmentProgress: { itemId: 0, status: 'pending' }
        }));
      }, 2000);
    }
  }, [scanState.selectedContainer, items, dispatch, queryClient, refetch]);

  // Gestion du scan
  const handleScanResult = useCallback(async (result: { success: boolean; message: string; type?: 'container' | 'item'; data?: any }) => {
    if (result.success) {
      if (result.type === 'container') {
        setScanState(prev => ({
          ...prev,
          scanMode: 'item',
          selectedContainer: containers.find(c => c.qrCode === result.data?.qrCode) || null
        }));
      } else if (result.type === 'item' && scanState.selectedContainer) {
        try {
          const item = items.find(i => i.qrCode === result.data?.qrCode);
          if (!item) return;

          const updateData = {
            ...item,
            containerId: scanState.selectedContainer.id,
            updatedAt: new Date().toISOString()
          };

          // Mise à jour optimiste
          dispatch(updateItemAction(updateData));

          // Mise à jour de la base de données
          await updateItem(item.id!, updateData);

          // Invalider les requêtes
          queryClient.invalidateQueries({ queryKey: ['items'] });
          queryClient.invalidateQueries({ queryKey: ['inventory'] });

          Alert.alert(
            'Succès',
            `Article ${item.name} assigné au container ${scanState.selectedContainer.name}`
          );
        } catch (error) {
          console.error('Erreur lors du scan:', error);
          await refetch();
          Alert.alert('Erreur', 'Impossible de scanner l\'article. Veuillez réessayer.');
        }
      }
    }
    setTimeout(() => setScanState(prev => ({ ...prev, isScannerActive: true })), 1500);
  }, [containers, items, scanState.selectedContainer, dispatch, queryClient, refetch]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.modeButton}
            onPress={() => {
              setScanState(prev => ({
                ...prev,
                mode: prev.mode === 'manual' ? 'scanner' : 'manual',
                selectedContainer: null,
                scanMode: 'container'
              }));
            }}
          >
            <MaterialIcons 
              name={scanState.mode === 'manual' ? "qr-code-scanner" : "edit"} 
              size={24} 
              color="#fff" 
            />
            <Text style={styles.modeButtonText}>
              {scanState.mode === 'manual' ? 'Mode Scanner' : 'Mode Manuel'}
            </Text>
          </TouchableOpacity>
        </View>

        {scanState.mode === 'manual' ? (
          <View style={styles.manualContainer}>
            <ScrollView>
              <Text style={styles.sectionTitle}>Sélectionner un container:</Text>
              <View style={styles.containerGrid}>
                {containers.map((container) => (
                  <TouchableOpacity
                    key={container.id}
                    style={[
                      styles.containerButton,
                      scanState.selectedContainer?.id === container.id && styles.containerSelected
                    ]}
                    onPress={() => setScanState(prev => ({ ...prev, selectedContainer: container }))}
                  >
                    <Text style={styles.containerText}>{container.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {scanState.selectedContainer && (
                <>
                  <Text style={styles.sectionTitle}>
                    Articles à assigner à {scanState.selectedContainer.name}:
                  </Text>
                
                  <View style={styles.searchContainer}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Rechercher un article..."
                      value={scanState.searchQuery}
                      onChangeText={(text) => setScanState(prev => ({ ...prev, searchQuery: text }))}
                    />
                  </View>

                  <View style={styles.filterContainer}>
                    <TouchableOpacity
                      style={[styles.filterButton, scanState.showOnlySelected && styles.filterButtonActive]}
                      onPress={() => setScanState(prev => ({ ...prev, showOnlySelected: !prev.showOnlySelected }))}
                    >
                      <Text style={[styles.filterButtonText, scanState.showOnlySelected && styles.filterButtonTextActive]}>
                        Articles assignés
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.filterButton, scanState.showOtherContainers && styles.filterButtonActive]}
                      onPress={() => setScanState(prev => ({ ...prev, showOtherContainers: !prev.showOtherContainers }))}
                    >
                      <Text style={[styles.filterButtonText, scanState.showOtherContainers && styles.filterButtonTextActive]}>
                        Tous les articles
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>

            {scanState.selectedContainer && (
              <FlatList
                data={filteredItems()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.itemRow,
                      item.containerId === scanState.selectedContainer?.id && styles.itemSelected,
                      item.containerId !== null && 
                      item.containerId !== scanState.selectedContainer?.id && 
                      styles.itemInOtherContainer,
                      scanState.assignmentProgress.itemId === item.id && 
                      scanState.assignmentProgress.status === 'pending' && 
                      styles.itemLoading
                    ]}
                    onPress={() => handleManualAssignment(item.id!)}
                    disabled={scanState.isAssigning || !scanState.selectedContainer}
                  >
                    <View style={styles.itemContent}>
                      <View>
                        <Text style={styles.itemText}>{item.name}</Text>
                        {item.containerId !== null && 
                         item.containerId !== scanState.selectedContainer?.id && (
                          <Text style={styles.containerInfo}>
                            Dans: {containers.find(c => c.id === item.containerId)?.name}
                          </Text>
                        )}
                      </View>
                      <View style={styles.itemStatus}>
                        {scanState.assignmentProgress.itemId === item.id ? (
                          scanState.assignmentProgress.status === 'pending' ? (
                            <ActivityIndicator size="small" color="#007AFF" />
                          ) : scanState.assignmentProgress.status === 'success' ? (
                            <MaterialIcons name="check-circle" size={24} color="#4CAF50" />
                          ) : (
                            <MaterialIcons name="error" size={24} color="#FF3B30" />
                          )
                        ) : (
                          item.containerId === scanState.selectedContainer?.id && (
                            <MaterialIcons name="check" size={24} color="#4CAF50" />
                          )
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
                keyExtractor={item => item.id!.toString()}
                style={styles.itemList}
              />
            )}
          </View>
        ) : (
          <View style={styles.scannerContainer}>
            <Scanner 
              onClose={() => router.back()} 
              isActive={scanState.isScannerActive}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ScanScreen; 