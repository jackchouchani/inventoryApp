import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { RootState } from '../../src/store/store';
import { Ionicons } from '@expo/vector-icons';
import { addContainer, addCategory, addItem } from '../../src/database/database';
import { useRefreshStore } from '../../src/store/refreshStore';
import { generateQRValue } from '../../src/utils/qrCodeManager';
import { Item } from '../../src/database/types';
import { DatabaseInterface } from '../../src/database/types';

interface ItemData {
  name: string;
  description: string;
  purchasePrice: number;
  sellingPrice: number;
  status: 'available';
  qrCode: string;
  containerId: number;
  categoryId: number;
}

export default function Settings() {
  const router = useRouter();
  const categories = useSelector((state: RootState) => state.categories.categories);
  const triggerRefresh = useRefreshStore(state => state.triggerRefresh);

  const generateTestData = async () => {
    try {
      // Create 4 containers (using Promise.all is acceptable for few items)
      const containerPromises = Array.from({ length: 4 }, (_, index) => {
        const containerNumber = index + 1;
        return addContainer({
          number: containerNumber,
          name: `Container Test ${containerNumber}`,
          description: `Container de test numéro ${containerNumber}`,
          qrCode: generateQRValue('CONTAINER')
        });
      });
      const containerIds = await Promise.all(containerPromises);

      // Create 2 categories
      const categoryPromises = [
        addCategory({ name: 'Vêtements Test', description: 'Catégorie test vêtements' }),
        addCategory({ name: 'Jouets Test', description: 'Catégorie test jouets' })
      ];
      const categoryIds = await Promise.all(categoryPromises);

      // Create 20 items sequentially to avoid SQLite concurrency issues
      for (let i = 0; i < 20; i++) {
        const randomPrice = Math.floor(Math.random() * 50) + 5;
        const randomContainerId = containerIds[Math.floor(Math.random() * containerIds.length)];
        const randomCategoryId = categoryIds[Math.floor(Math.random() * categoryIds.length)];

        const itemData: Omit<Item, 'id' | 'createdAt' | 'updatedAt'> = {
          name: `Item Test ${i + 1}`,
          description: `Description de l'item test ${i + 1}`,
          purchasePrice: randomPrice,
          sellingPrice: randomPrice * 2,
          status: 'available',
          qrCode: generateQRValue('ITEM'),
          containerId: randomContainerId,
          categoryId: randomCategoryId
        };

        // Await each addItem call sequentially
        await addItem(itemData);
      }

      triggerRefresh();
      Alert.alert(
        'Succès',
        '4 containers, 2 catégories, et 20 items de test ont été créés avec succès'
      );
    } catch (error) {
      console.error('Erreur lors de la génération des données:', error);
      Alert.alert('Erreur', 'Impossible de générer les données de test');
    }
  };

  if (!categories) {
    return <Text>Loading...</Text>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.title}>Paramètres</Text>
      </View>
      
      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/(stack)/containers')}
      >
        <Icon name="inbox" size={24} color="#007AFF" />
        <Text style={styles.menuText}>Gérer les containers</Text>
        <Icon name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/(stack)/categories')}
      >
        <Icon name="category" size={24} color="#007AFF" />
        <Text style={styles.menuText}>Gérer les catégories</Text>
        <Icon name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/(stack)/labels')}
      >
        <Icon name="label" size={24} color="#007AFF" />
        <Text style={styles.menuText}>Générer des étiquettes</Text>
        <Icon name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/(stack)/backup')}
      >
        <Icon name="backup" size={24} color="#007AFF" />
        <Text style={styles.menuText}>Sauvegarde</Text>
        <Icon name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.menuItem, { marginTop: 20 }]}
        onPress={generateTestData}
      >
        <Icon name="data-usage" size={24} color="#FF9500" />
        <Text style={styles.menuText}>Générer données de test</Text>
        <Icon name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    height: 60,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 15,
    color: '#333',
  },
}); 