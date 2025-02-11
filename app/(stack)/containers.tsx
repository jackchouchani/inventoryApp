import React, { useState, useEffect } from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, Text, SafeAreaView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Container, Item } from '../../src/database/types';
import { ContainerGrid } from '../../src/components/ContainerGrid';
import { ContainerForm } from '../../src/components/ContainerForm';
import { ItemList } from '../../src/components/ItemList';
import { useInventoryData, useContainerItems, useContainerMutation, usePrefetchContainerData } from '../../src/hooks/useInventoryData';
import { handleDatabaseError } from '../../src/utils/errorHandler';
import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../../src/config/supabase';
import { useRefreshStore } from '../../src/store/refreshStore';

const ContainerScreen = () => {
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [showContainerForm, setShowContainerForm] = useState(false);
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);
  const router = useRouter();
  const triggerRefresh = useRefreshStore(state => state.triggerRefresh);

  // Récupération des données
  const { data: inventoryData, isLoading: isLoadingInventory } = useInventoryData();
  const { data: containerItems, isLoading: isLoadingItems } = useContainerItems(selectedContainer?.id || 0);
  const containerMutation = useContainerMutation();
  const prefetchContainer = usePrefetchContainerData(selectedContainer?.id || 0);

  // Préchargement des données du container
  useEffect(() => {
    if (selectedContainer?.id) {
      prefetchContainer();
    }
  }, [selectedContainer?.id]);

  const handleContainerPress = (containerId: number) => {
    const container = inventoryData?.containers.find(c => c.id === containerId);
    if (container) {
      setSelectedContainer(container);
    }
  };

  const handleEditContainer = (container: Container) => {
    setSelectedContainer(null);
    setTimeout(() => {
      setEditingContainer(container);
      setShowContainerForm(true);
    }, 300);
  };

  const handleContainerSubmit = async (containerData: Omit<Container, 'id'>) => {
    try {
      if (editingContainer?.id) {
        await containerMutation.mutateAsync({
          id: editingContainer.id,
          data: containerData
        });
        setShowContainerForm(false);
        setEditingContainer(null);
      }
    } catch (error) {
      if (error instanceof Error || error instanceof PostgrestError) {
        handleDatabaseError(error, 'ContainerScreen.handleContainerSubmit');
      }
    }
  };

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
        <Text>Chargement des containers...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity 
        style={styles.addButton} 
        onPress={() => setShowContainerForm(true)}
      >
        <Text style={styles.addButtonText}>Ajouter un Container</Text>
      </TouchableOpacity>

      <ContainerGrid
        containers={inventoryData?.containers || []}
        items={containerItems || []}
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
                <Text style={styles.actionButtonText}>Modifier</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => selectedContainer?.id && handleDeleteContainer(selectedContainer.id)}
              >
                <Text style={styles.deleteButtonText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {isLoadingItems ? (
            <View style={styles.loadingContainer}>
              <Text>Chargement des articles...</Text>
            </View>
          ) : (
            <ItemList
              items={containerItems || []}
              containers={inventoryData?.containers || []}
              categories={inventoryData?.categories || []}
              onMarkAsSold={() => {}}
              onMarkAsAvailable={() => {}}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

export default ContainerScreen;

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
  modalContent: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSpacer: {
    width: 70,
  },
  cancelButton: {
    padding: 8,
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  formWrapper: {
    flex: 1,
    padding: 20,
  },
  addButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    margin: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    padding: 8,
  },
  actionButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  deleteButton: {
    marginLeft: 10,
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 16,
  },
});