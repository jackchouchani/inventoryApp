import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal, FlatList, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import Scanner from '../../src/components/Scanner';
import { Container, Item, updateItem, getContainers, getItems } from '../../src/database/database';
import { useRefreshStore } from '../../src/store/refreshStore';

// Ajouter un type pour les props de l'item
interface ItemProps {
  item: Item;
}

const ScanScreen: React.FC = () => {
  const router = useRouter();
  const [showManualMode, setShowManualMode] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const refreshTimestamp = useRefreshStore(state => state.refreshTimestamp);
  const triggerRefresh = useRefreshStore(state => state.triggerRefresh);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [showOtherContainers, setShowOtherContainers] = useState(false);

  const loadData = async () => {
    try {
      setError(null);
      const [loadedContainers, loadedItems] = await Promise.all([
        getContainers(),
        getItems()
      ]);
      setContainers(loadedContainers);
      setItems(loadedItems);
    } catch (error) {
      setError("Erreur lors du chargement des données");
      console.error('Erreur lors du chargement des données:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTimestamp]);

  const handleManualAssignment = async (itemId: number) => {
    if (!selectedContainer) return;
    
    try {
      const item = items.find(i => i.id === itemId);
      if (!item) return;
      
      const updateData = {
        ...item,
        containerId: item.containerId === selectedContainer.id ? null : selectedContainer.id,
        updatedAt: new Date().toISOString()
      };
      
      await updateItem(itemId, updateData);
      triggerRefresh();
      
      // Ajouter un feedback visuel
      Alert.alert(
        'Succès',
        `Article ${item.name} ${item.containerId === selectedContainer.id ? 'retiré du' : 'ajouté au'} container ${selectedContainer.name}`
      );
    } catch (error) {
      console.error('Erreur lors de l\'assignation:', error);
      Alert.alert('Erreur', 'Impossible d\'assigner l\'article');
    }
  };

  // Ajouter un état pour suivre si le scanner est actif
  const [isScannerActive, setIsScannerActive] = useState(true);

  // Réinitialiser le scanner quand on change de mode
  useEffect(() => {
    setIsScannerActive(true);
  }, [showManualMode]);

  // Fonction pour filtrer les articles selon les critères
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (showOnlySelected) {
      return matchesSearch && item.containerId === selectedContainer?.id;
    }
    
    if (showOtherContainers) {
      return matchesSearch;
    }
    
    return matchesSearch && (item.containerId === null || item.containerId === selectedContainer?.id);
  });

  // Extraire le rendu de l'item dans un composant séparé pour améliorer la lisibilité
  const renderItem = ({ item }: ItemProps) => (
    <TouchableOpacity
      style={[
        styles.itemRow,
        item.containerId === selectedContainer?.id && styles.itemSelected
      ]}
      onPress={() => handleManualAssignment(item.id!)}
      disabled={!selectedContainer}
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
          onPress={() => {
            setShowManualMode(!showManualMode);
            setSelectedContainer(null); // Réinitialiser le container sélectionné
          }}
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
              
              {/* Barre de recherche */}
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Rechercher un article..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              {/* Filtres */}
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

              <FlatList
                data={filteredItems}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.itemRow,
                      item.containerId === selectedContainer?.id && styles.itemSelected,
                      item.containerId !== null && item.containerId !== selectedContainer?.id && styles.itemInOtherContainer
                    ]}
                    onPress={() => handleManualAssignment(item.id!)}
                    disabled={!selectedContainer}
                  >
                    <View>
                      <Text style={styles.itemText}>{item.name}</Text>
                      {item.containerId !== null && item.containerId !== selectedContainer?.id && (
                        <Text style={styles.containerInfo}>
                          Dans: {containers.find(c => c.id === item.containerId)?.name}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.itemStatus}>
                      {item.containerId === selectedContainer?.id ? '✓' : ''}
                    </Text>
                  </TouchableOpacity>
                )}
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
        <Scanner 
          onClose={() => router.back()} 
          isActive={isScannerActive}
          onScan={(result) => {
            // Désactiver temporairement le scanner après un scan réussi
            setIsScannerActive(false);
            // Réactiver le scanner après un délai
            setTimeout(() => setIsScannerActive(true), 1500);
          }}
        />
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
});

export default ScanScreen; 