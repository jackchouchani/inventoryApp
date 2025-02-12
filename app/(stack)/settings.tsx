import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../src/store/store';
import { 
  resetDatabase, 
  addCategory, 
  addContainer, 
  addItem,
  getItems,
  getCategories,
  getContainers 
} from '../../src/database/database';
import { useRefreshStore } from '../../src/store/refreshStore';
import { generateQRValue } from 'utils/qrCodeManager';
import { useAuth } from '../../src/contexts/AuthContext';
import { selectAllCategories } from '../../src/store/categorySlice';

const SettingsScreen = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const triggerRefresh = useRefreshStore(state => state.triggerRefresh);
  const categories = useSelector(selectAllCategories);
  const { signOut } = useAuth();

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await getCategories();
        dispatch({ type: 'categories/setCategories', payload: cats });
      } catch (error) {
        console.error('Erreur lors du chargement des catégories:', error);
      }
    };
    
    if (!Array.isArray(categories) || categories.length === 0) {
      loadCategories();
    }
  }, [dispatch]);

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
    }
  };

  const generateTestData = async () => {
    try {
      // Ajouter des catégories comme dans CategoryScreen
      const cat1Id = await addCategory({ 
        name: 'Vêtements', 
        description: 'Tous types de vêtements',
      });
      const cat2Id = await addCategory({ 
        name: 'Électronique', 
        description: 'Appareils électroniques',
      });
      const cat3Id = await addCategory({ 
        name: 'Livres', 
        description: 'Livres et magazines',
      });

      // Ajouter des containers comme dans ContainerForm
      const cont1Id = await addContainer({ 
        number: 1,
        name: 'Box A1', 
        description: 'Premier container',
        qrCode: generateQRValue('CONTAINER'),
      });
      const cont2Id = await addContainer({ 
        number: 2,
        name: 'Box B2', 
        description: 'Deuxième container',
        qrCode: generateQRValue('CONTAINER'),
      });

      // Ajouter des items comme dans ItemForm
      await addItem({
        name: 'T-shirt bleu',
        description: 'T-shirt en coton',
        purchasePrice: 5,
        sellingPrice: 15,
        status: 'available',
        qrCode: generateQRValue('ITEM'),
        categoryId: cat1Id,
        containerId: cont1Id
      });

      await addItem({
        name: 'Smartphone',
        description: 'Téléphone Android',
        purchasePrice: 100,
        sellingPrice: 200,
        status: 'available',
        qrCode: generateQRValue('ITEM'),
        categoryId: cat2Id,
        containerId: cont1Id
      });

      await addItem({
        name: 'Roman policier',
        description: 'Livre de poche',
        purchasePrice: 3,
        sellingPrice: 8,
        status: 'available',
        qrCode: generateQRValue('ITEM'),
        categoryId: cat3Id,
        containerId: cont2Id
      });

      triggerRefresh();
      Alert.alert('Succès', 'Données de test générées avec succès');
    } catch (error) {
      console.error('Erreur lors de la génération des données de test:', error);
      Alert.alert('Erreur', 'Impossible de générer les données de test');
    }
  };

  if (!categories) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
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
        style={[styles.menuItem, styles.dangerItem]}
        onPress={generateTestData}
      >
        <Icon name="science" size={24} color="#FF3B30" />
        <Text style={[styles.menuText, styles.dangerText]}>Générer données de test</Text>
        <Icon name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.menuItem, { marginTop: 20, borderTopWidth: 1, borderTopColor: '#e5e5e5' }]}
        onPress={handleLogout}
      >
        <Icon name="logout" size={24} color="#FF3B30" />
        <Text style={[styles.menuText, { color: '#FF3B30' }]}>Se déconnecter</Text>
        <Icon name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  menuText: {
    flex: 1,
    marginLeft: 15,
    fontSize: 16,
  },
  dangerItem: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    backgroundColor: '#fff5f5',
  },
  dangerText: {
    color: '#FF3B30',
    fontWeight: '500',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});

export default SettingsScreen; 