import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, Text, SafeAreaView, Alert, ActivityIndicator, TextInput, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Container } from '../../src/types/container';
import { Item } from '../../src/types/item';
import { ContainerGrid } from '../../src/components/ContainerGrid';
import { ContainerForm } from '../../src/components/ContainerForm';
import ItemList from '../../src/components/ItemList';
import { useInventoryData } from '../../src/hooks/useInventoryData';
import { handleDatabaseError } from '../../src/utils/errorHandler';
import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../../src/config/supabase';
import { useRefreshStore } from '../../src/store/refreshStore';
import { MaterialIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { updateItem, setItems } from '../../src/store/itemsActions';
import { selectAllItems } from '../../src/store/itemsAdapter';
import { RootState } from '../../src/store/store';

const ContainerScreen = () => {
  const dispatch = useDispatch();
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [showContainerForm, setShowContainerForm] = useState(false);
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const { items: initialItems, containers, categories, isLoading: isLoadingInventory } = useInventoryData();
  const items = useSelector((state: RootState) => selectAllItems(state));
  const triggerRefresh = useRefreshStore(state => state.triggerRefresh);
  const router = useRouter();

  // Synchroniser les données de useInventoryData avec Redux
  useEffect(() => {
    if (initialItems?.length > 0) {
      dispatch(setItems(initialItems));
    }
  }, [initialItems, dispatch]);

  // Utiliser useMemo pour les items filtrés avec une meilleure logique de filtrage
  const { assignedItems, filteredAvailableItems } = useMemo(() => {
    const assigned = items.filter(item => 
      item.containerId === selectedContainer?.id && 
      item.status === 'available'
    );

    const available = items.filter(item => 
      item.status === 'available' && 
      (item.containerId === null || item.containerId !== selectedContainer?.id)
    );
    
    const filtered = available.filter(item => {
      const matchesSearch = searchQuery ? 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) : true;
      const matchesCategory = selectedCategory ? 
        item.categoryId === selectedCategory : true;
      return matchesSearch && matchesCategory;
    });

    return {
      assignedItems: assigned,
      filteredAvailableItems: filtered
    };
  }, [items, selectedContainer, searchQuery, selectedCategory]);

  const handleContainerPress = useCallback((containerId: number) => {
    const container = containers.find(c => c.id === containerId);
    if (container) {
      setSelectedContainer(container);
    }
  }, [containers]);

  const handleEditContainer = useCallback((container: Container) => {
    setEditingContainer(container);
    setShowContainerForm(true);
    setSelectedContainer(null);
  }, []);

  const handleContainerSubmit = useCallback(async (containerData: Partial<Container>) => {
    try {
      // Récupérer l'utilisateur actuel
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Utilisateur non connecté');

      const formattedData = {
        name: containerData.name,
        description: containerData.description || '',
        number: containerData.number || null,
        qr_code: containerData.qrCode || null,
        user_id: user.id,
        deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('Données du container à créer:', formattedData);

      if (editingContainer?.id) {
        const { error } = await supabase
          .from('containers')
          .update(formattedData)
          .eq('id', editingContainer.id);

        if (error) {
          console.error('Erreur lors de la mise à jour:', error);
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('containers')
          .insert(formattedData);

        if (error) {
          console.error('Erreur lors de la création:', error);
          throw error;
        }
      }

      setShowContainerForm(false);
      setEditingContainer(null);
      triggerRefresh();
    } catch (error) {
      console.error('Erreur complète:', error);
      if (error instanceof Error || error instanceof PostgrestError) {
        handleDatabaseError(error, 'ContainerScreen.handleContainerSubmit');
      }
      Alert.alert(
        'Erreur',
        'Une erreur est survenue lors de la création du container. Veuillez réessayer.'
      );
    }
  }, [editingContainer, triggerRefresh]);

  const handleAddToContainer = useCallback(async (itemId: number) => {
    if (!selectedContainer?.id) return;

    const itemToUpdate = items.find(item => item.id === itemId);
    if (!itemToUpdate) return;

    // Mise à jour optimiste immédiate avec Redux
    const updatedItemData = {
      ...itemToUpdate,
      containerId: selectedContainer.id,
      updatedAt: new Date().toISOString()
    };

    // Dispatch immédiat pour mise à jour UI
    dispatch(updateItem(updatedItemData));

    // Mise à jour Supabase en arrière-plan
    (async () => {
      try {
        const { error } = await supabase
          .from('items')
          .update({
            container_id: selectedContainer.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', itemId);

        if (error) {
          // En cas d'erreur, on revient à l'état précédent
          dispatch(updateItem(itemToUpdate));
          console.error('Erreur lors de l\'ajout au container:', error);
          Alert.alert(
            'Erreur',
            'Une erreur est survenue lors de l\'ajout de l\'article au container.'
          );
        }
      } catch (error) {
        dispatch(updateItem(itemToUpdate));
        console.error('Erreur lors de l\'ajout au container:', error);
      }
    })();

  }, [selectedContainer, items, dispatch]);

  const handleDeleteFromContainer = useCallback(async (itemId: number) => {
    const itemToUpdate = items.find(item => item.id === itemId);
    if (!itemToUpdate) return;

    // Mise à jour optimiste immédiate avec Redux
    const updatedItemData = {
      ...itemToUpdate,
      containerId: null,
      updatedAt: new Date().toISOString()
    };

    // Dispatch immédiat pour mise à jour UI
    dispatch(updateItem(updatedItemData));

    // Mise à jour Supabase en arrière-plan
    (async () => {
      try {
        const { error } = await supabase
          .from('items')
          .update({
            container_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', itemId);

        if (error) {
          // En cas d'erreur, on revient à l'état précédent
          dispatch(updateItem(itemToUpdate));
          console.error('Erreur lors de la suppression du container:', error);
          Alert.alert(
            'Erreur',
            'Une erreur est survenue lors de la suppression de l\'article du container.'
          );
        }
      } catch (error) {
        dispatch(updateItem(itemToUpdate));
        console.error('Erreur lors de la suppression du container:', error);
      }
    })();

  }, [items, dispatch]);

  const handleDeleteContainer = async (containerId: number) => {
    Alert.alert(
      'Supprimer le container',
      'Êtes-vous sûr de vouloir supprimer ce container ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('containers')
                .delete()
                .eq('id', containerId);

              if (error) throw error;
              
              setSelectedContainer(null);
              triggerRefresh();
            } catch (error) {
              if (error instanceof Error || error instanceof PostgrestError) {
                handleDatabaseError(error, 'ContainerScreen.handleDeleteContainer');
              }
            }
          }
        }
      ]
    );
  };

  if (isLoadingInventory) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Chargement des containers...</Text>
      </View>
    );
  }

  if (!containers || containers.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.push('/(stack)/settings')}
          >
            <MaterialIcons name="arrow-back-ios" size={18} color="#007AFF" />
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.emptyStateContainer}>
          <MaterialIcons name="inbox" size={64} color="#ccc" />
          <Text style={styles.emptyStateText}>Aucun container disponible</Text>
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={() => setShowContainerForm(true)}
          >
            <Text style={styles.addButtonText}>Créer un container</Text>
          </TouchableOpacity>
        </View>

        <Modal
          visible={showContainerForm}
          animationType="slide"
          onRequestClose={() => {
            setShowContainerForm(false);
            setEditingContainer(null);
          }}
        >
          <SafeAreaView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => {
                  setShowContainerForm(false);
                  setEditingContainer(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Nouveau Container</Text>
              <View style={styles.headerSpacer} />
            </View>
            
            <View style={styles.formWrapper}>
              <ContainerForm
                onSubmit={handleContainerSubmit}
                onCancel={() => {
                  setShowContainerForm(false);
                  setEditingContainer(null);
                }}
              />
            </View>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.push('/(stack)/settings')}
        >
          <MaterialIcons name="arrow-back-ios" size={18} color="#007AFF" />
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.addButton} 
        onPress={() => setShowContainerForm(true)}
      >
        <MaterialIcons name="add" size={24} color="#fff" style={styles.addIcon} />
        <Text style={styles.addButtonText}>Ajouter un Container</Text>
      </TouchableOpacity>

      <ContainerGrid
        containers={containers}
        items={items}
        onContainerPress={handleContainerPress}
      />

      <Modal
        visible={showContainerForm}
        animationType="slide"
        onRequestClose={() => {
          setShowContainerForm(false);
          setEditingContainer(null);
        }}
      >
        <SafeAreaView style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => {
                setShowContainerForm(false);
                setEditingContainer(null);
              }}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingContainer ? 'Modifier Container' : 'Nouveau Container'}
            </Text>
            <View style={styles.headerSpacer} />
          </View>
          
          <View style={styles.formWrapper}>
            <ContainerForm
              initialData={editingContainer}
              onSubmit={handleContainerSubmit}
              onCancel={() => {
                setShowContainerForm(false);
                setEditingContainer(null);
              }}
            />
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={!!selectedContainer}
        animationType="slide"
        onRequestClose={() => setSelectedContainer(null)}
      >
        <SafeAreaView style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setSelectedContainer(null)}
            >
              <Text style={styles.cancelButtonText}>Retour</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedContainer?.name || 'Container'}
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => selectedContainer && handleEditContainer(selectedContainer)}
              >
                <MaterialIcons name="edit" size={24} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => selectedContainer?.id && handleDeleteContainer(selectedContainer.id)}
              >
                <MaterialIcons name="delete" size={24} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </View>
          
          <ScrollView style={styles.containerScrollView}>
            <View style={styles.containerDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Numéro:</Text>
                <Text style={styles.detailValue}>#{selectedContainer?.number}</Text>
              </View>
              {selectedContainer?.description && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Description:</Text>
                  <Text style={styles.detailValue}>{selectedContainer.description}</Text>
                </View>
              )}
            </View>

            <View style={styles.containerContent}>
              <Text style={styles.contentTitle}>Articles dans ce container</Text>
              <View style={styles.itemsContainer}>
                <View style={styles.filterSection}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Rechercher un article..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.categoryFilter}
                  >
                    <TouchableOpacity
                      style={[
                        styles.categoryChip,
                        !selectedCategory && styles.categoryChipSelected
                      ]}
                      onPress={() => setSelectedCategory(null)}
                    >
                      <Text style={[
                        styles.categoryChipText,
                        !selectedCategory && styles.categoryChipTextSelected
                      ]}>Tous</Text>
                    </TouchableOpacity>
                    {categories.map(category => (
                      <TouchableOpacity
                        key={category.id}
                        style={[
                          styles.categoryChip,
                          selectedCategory === category.id && styles.categoryChipSelected
                        ]}
                        onPress={() => setSelectedCategory(
                          selectedCategory === category.id ? null : category.id ?? null
                        )}
                      >
                        <Text style={[
                          styles.categoryChipText,
                          selectedCategory === category.id && styles.categoryChipTextSelected
                        ]}>{category.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.listsContainer}>
                  <View style={styles.listSection}>
                    <Text style={styles.sectionTitle}>
                      Articles assignés ({assignedItems.length})
                    </Text>
                    <ScrollView style={styles.itemsList}>
                      {assignedItems.length > 0 ? (
                        assignedItems.map(item => (
                          <TouchableOpacity
                            key={item.id}
                            style={styles.itemCard}
                            onPress={() => handleDeleteFromContainer(item.id!)}
                          >
                            <View style={styles.itemInfo}>
                              <Text style={styles.itemName}>{item.name}</Text>
                              <Text style={styles.itemCategory}>
                                {categories.find(c => c.id === item.categoryId)?.name}
                              </Text>
                              <Text style={styles.itemPrice}>{item.sellingPrice}€</Text>
                            </View>
                            <MaterialIcons name="remove-circle-outline" size={24} color="#FF3B30" />
                          </TouchableOpacity>
                        ))
                      ) : (
                        <Text style={styles.emptyContentText}>Aucun article dans ce container</Text>
                      )}
                    </ScrollView>
                  </View>

                  <View style={styles.listSection}>
                    <Text style={styles.sectionTitle}>
                      Articles disponibles ({filteredAvailableItems.length})
                    </Text>
                    <ScrollView style={styles.itemsList}>
                      {filteredAvailableItems.length > 0 ? (
                        filteredAvailableItems.map(item => (
                          <TouchableOpacity
                            key={item.id}
                            style={[styles.itemCard, styles.availableItem]}
                            onPress={() => handleAddToContainer(item.id!)}
                          >
                            <View style={styles.itemInfo}>
                              <Text style={styles.itemName}>{item.name}</Text>
                              <Text style={styles.itemCategory}>
                                {categories.find(c => c.id === item.categoryId)?.name}
                              </Text>
                              {item.containerId && (
                                <Text style={styles.containerInfo}>
                                  Dans: {containers.find(c => c.id === item.containerId)?.name}
                                </Text>
                              )}
                              <Text style={styles.itemPrice}>{item.sellingPrice}€</Text>
                            </View>
                            <MaterialIcons name="add-circle-outline" size={24} color="#4CAF50" />
                          </TouchableOpacity>
                        ))
                      ) : (
                        <Text style={styles.emptyContentText}>Aucun article disponible</Text>
                      )}
                    </ScrollView>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  topBar: {
    height: Platform.OS === 'ios' ? 44 : 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    marginTop: Platform.OS === 'ios' ? 47 : 0,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginLeft: -8,
  },
  backButtonText: {
    fontSize: 17,
    color: '#007AFF',
    marginLeft: -4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 15,
    margin: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addIcon: {
    marginRight: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  headerSpacer: {
    width: 70,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  cancelButton: {
    padding: 8,
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  actionButton: {
    padding: 8,
  },
  deleteButton: {
    marginLeft: 8,
  },
  formWrapper: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  containerDetails: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    width: 100,
  },
  detailValue: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
  containerContent: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentTitle: {
    fontSize: 18,
    fontWeight: '600',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyContentText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  itemsContainer: {
    flex: 1,
    padding: 16,
  },
  listsContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
  },
  listSection: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    padding: 12,
  },
  itemsList: {
    flex: 1,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  availableItem: {
    borderLeftColor: '#4CAF50',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    color: '#666',
  },
  filterSection: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryFilter: {
    flexGrow: 0,
    marginBottom: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  categoryChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#666',
  },
  categoryChipTextSelected: {
    color: '#fff',
  },
  itemCategory: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  containerScrollView: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  containerInfo: {
    fontSize: 12,
    color: '#FF9500',
    marginBottom: 4,
    fontStyle: 'italic'
  },
});

export default ContainerScreen;