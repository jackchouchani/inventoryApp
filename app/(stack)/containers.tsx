import React, { useState, useEffect } from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, Text, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Container, Item, getContainers, getItems, addContainer, updateItem, deleteContainer, updateContainer } from '../../src/database/database';
import { ContainerGrid } from '../../src/components/ContainerGrid';
import { ContainerForm } from '../../src/components/ContainerForm';
import { ItemList } from '../../src/components/ItemList';
import { useRefreshStore } from '../../src/store/refreshStore';

const ContainerScreen = () => {
  const [containers, setContainers] = useState<Container[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [showContainerForm, setShowContainerForm] = useState(false);
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);
  const refreshTimestamp = useRefreshStore(state => state.refreshTimestamp);
  const router = useRouter();

  const loadData = async () => {
    try {
      const [loadedContainers, loadedItems] = await Promise.all([
        getContainers(),
        getItems()
      ]);
      setContainers(loadedContainers);
      setItems(loadedItems);
    } catch (error) {
      console.error('Error loading containers data:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTimestamp]);

  const handleContainerPress = (containerId: number) => {
    const container = containers.find(c => c.id === containerId);
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

  const handleDeleteContainer = async (containerId: number) => {
    try {
      await deleteContainer(containerId);
      await loadData();
      setSelectedContainer(null);
    } catch (error) {
      console.error('Error deleting container:', error);
    }
  };

  const handleContainerSubmit = async (containerData: Omit<Container, 'id'>) => {
    try {
      if (editingContainer?.id) {
        await updateContainer(editingContainer.id, containerData);
      } else {
        await addContainer(containerData);
      }
      await loadData();
      setShowContainerForm(false);
      setEditingContainer(null);
    } catch (error) {
      console.error('Error saving container:', error);
    }
  };

  const handleItemMove = async (itemId: number, newContainerId: number) => {
    try {
      const item = items.find(i => i.id === itemId);
      if (item) {
        await updateItem(itemId, {
          ...item,
          containerId: newContainerId,
          updatedAt: new Date().toISOString()
        });
        await loadData();
      }
    } catch (error) {
      console.error('Error moving item:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity 
        style={styles.addButton} 
        onPress={() => setShowContainerForm(true)}
      >
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
          
          <ItemList
            items={items.filter(item => item.containerId === selectedContainer?.id)}
            containers={containers}
            categories={[]}
            onMarkAsSold={() => {}}
            onMarkAsAvailable={() => {}}
          />
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
    width: 70, // même largeur que le bouton annuler pour centrer le titre
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