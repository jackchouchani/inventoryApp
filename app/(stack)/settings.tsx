import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../src/store/store';
import { database, createContainer, createItem } from '../../src/database/database';
import { useRefreshStore } from '../../src/store/refreshStore';
import { generateQRValue } from 'utils/qrCodeManager';
import { useAuth } from '../../src/contexts/AuthContext';
import { selectAllCategories } from '../../src/store/categorySlice';
import { useQueryClient } from '@tanstack/react-query';

const SettingsScreen = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const triggerRefresh = useRefreshStore(state => state.triggerRefresh);
  const categories = useSelector(selectAllCategories);
  const { signOut } = useAuth();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
    }
  };

  const handleResetDatabase = async () => {
    try {
      Alert.alert(
        'Réinitialiser la base de données',
        'Êtes-vous sûr de vouloir réinitialiser la base de données ? Cette action est irréversible.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Réinitialiser',
            style: 'destructive',
            onPress: async () => {
              try {
                await database.resetDatabase();
                // Invalider tous les caches
                await queryClient.invalidateQueries();
                triggerRefresh();
                Alert.alert('Succès', 'Base de données réinitialisée avec succès');
              } catch (error) {
                console.error('Erreur lors de la réinitialisation:', error);
                Alert.alert('Erreur', 'Impossible de réinitialiser la base de données');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
      Alert.alert('Erreur', 'Impossible de réinitialiser la base de données');
    }
  };

  const generateTestData = async () => {
    try {
      // Ajouter des catégories
      const cat1Id = await database.addCategory({ 
        name: 'Vêtements', 
        description: 'Tous types de vêtements',
      });
      const cat2Id = await database.addCategory({ 
        name: 'Électronique', 
        description: 'Appareils électroniques',
      });
      const cat3Id = await database.addCategory({ 
        name: 'Livres', 
        description: 'Livres et magazines',
      });

      // Ajouter des containers avec le nouveau système d'identifiants
      const container1 = await createContainer({ 
        number: 1,
        name: 'Box A1', 
        description: 'Premier container'
      });
      const container2 = await createContainer({ 
        number: 2,
        name: 'Box B2', 
        description: 'Deuxième container'
      });

      // Ajouter des items avec le nouveau système d'identifiants
      await createItem({
        name: 'T-shirt bleu',
        description: 'T-shirt en coton',
        purchasePrice: 5,
        sellingPrice: 15,
        status: 'available',
        categoryId: cat1Id,
        containerId: container1.id
      });

      await createItem({
        name: 'Smartphone',
        description: 'Téléphone Android',
        purchasePrice: 100,
        sellingPrice: 200,
        status: 'available',
        categoryId: cat2Id,
        containerId: container1.id
      });

      await createItem({
        name: 'Roman policier',
        description: 'Livre de poche',
        purchasePrice: 3,
        sellingPrice: 8,
        status: 'available',
        categoryId: cat3Id,
        containerId: container2.id
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
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.push('/(tabs)/stock')}
        >
          <MaterialIcons name="arrow-back-ios" size={18} color="#007AFF" />
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/(stack)/containers')}
      >
        <MaterialIcons name="inbox" size={24} color="#007AFF" />
        <Text style={styles.menuText}>Gérer les containers</Text>
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/(stack)/categories')}
      >
        <MaterialIcons name="category" size={24} color="#007AFF" />
        <Text style={styles.menuText}>Gérer les catégories</Text>
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/(stack)/labels')}
      >
        <MaterialIcons name="label" size={24} color="#007AFF" />
        <Text style={styles.menuText}>Générer des étiquettes</Text>
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.menuItem, styles.dangerItem]}
        onPress={handleResetDatabase}
      >
        <MaterialIcons name="delete-forever" size={24} color="#FF3B30" />
        <Text style={[styles.menuText, styles.dangerText]}>Réinitialiser la base de données</Text>
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.menuItem, styles.dangerItem, { borderTopWidth: 0 }]}
        onPress={generateTestData}
      >
        <MaterialIcons name="science" size={24} color="#FF3B30" />
        <Text style={[styles.menuText, styles.dangerText]}>Générer données de test</Text>
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.menuItem, { marginTop: 20, borderTopWidth: 1, borderTopColor: '#e5e5e5' }]}
        onPress={handleLogout}
      >
        <MaterialIcons name="logout" size={24} color="#FF3B30" />
        <Text style={[styles.menuText, { color: '#FF3B30' }]}>Se déconnecter</Text>
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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