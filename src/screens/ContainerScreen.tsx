import React, { useState, useEffect } from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Container, Item, getContainers, getItems, addContainer, updateItem } from '../database/database';
import { ContainerGrid } from '../components/ContainerGrid';
import { ContainerForm } from '../components/ContainerForm';
import { ItemList } from '../components/ItemList';

export const ContainerScreen = () => {
  const [containers, setContainers] = useState<Container[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [showContainerForm, setShowContainerForm] = useState(false);
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [loadedContainers, loadedItems] = await Promise.all([
        getContainers(),
        getItems()
      ]);
      setContainers(loadedContainers);
      setItems(loadedItems);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleContainerPress = (containerId: number) => {
    const container = containers.find(c => c.id === containerId);
    if (container) {
      setSelectedContainer(container);
    }
  };

  const handleContainerSubmit = async (containerData: Omit<Container, 'id'>) => {
    try {
      if (editingContainer?.id) {
        // Import updateContainer from database module first
        // For now just use addContainer since updateContainer isn't available
        await addContainer(containerData);
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
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.addButton} 
        onPress={() => setShowContainerForm(true)}
      >
        <Text style={styles.addButtonText}>Add Container</Text>
      </TouchableOpacity>

      <ContainerGrid
        containers={containers}
        items={items}
        onContainerPress={handleContainerPress}
      />

      <Modal
        visible={!!selectedContainer}
        animationType="slide"
        onRequestClose={() => setSelectedContainer(null)}
      >
        <View style={styles.modalContent}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setSelectedContainer(null)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
          <ItemList
            items={items.filter(item => item.containerId === selectedContainer?.id)}
            containers={containers}
            categories={[]}
            onMarkAsSold={() => {}}
          />
        </View>
      </Modal>

      <Modal
        visible={showContainerForm}
        animationType="slide"
        onRequestClose={() => {
          setShowContainerForm(false);
          setEditingContainer(null);
        }}
      >
        <View style={styles.modalContent}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => {
              setShowContainerForm(false);
              setEditingContainer(null);
            }}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
          <View style={styles.formWrapper}>
            <ContainerForm
              container={editingContainer || undefined}
              onSubmit={handleContainerSubmit}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#fff',
  },
  closeButton: {
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#6c757d',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  formWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  addButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    margin: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});