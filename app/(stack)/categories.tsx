import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Platform
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../src/store/store';
import { deleteCategory, editCategory, setCategories, addNewCategory } from '../../src/store/categorySlice';
import { database } from '../../src/database/database';
import type { Category } from '../../src/types/category';
import { MaterialIcons } from '@expo/vector-icons';
import type { MaterialIconName } from '../../src/types/icons';
import { useRouter } from 'expo-router';
import { selectAllCategories } from '../../src/store/categorySlice';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

const CategoryScreen = () => {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const categories = useSelector((state: RootState) => selectAllCategories(state)) as Category[];
  const router = useRouter();

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: withSpring(1) }],
      opacity: withSpring(1)
    };
  });

  const loadCategories = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const loadedCategories = await database.getCategories();
      dispatch(setCategories(loadedCategories));
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error);
      setError('Erreur lors du chargement des catégories');
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleAddCategory = () => {
    router.push('/(stack)/add-category');
  };

  const handleEditCategory = (category: Category) => {
    router.push({
      pathname: '/(stack)/edit-category',
      params: { id: category.id }
    });
  };

  const handleDeleteCategory = async (category: Category) => {
    Alert.alert(
      'Supprimer la catégorie',
      `Êtes-vous sûr de vouloir supprimer "${category.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!category.id) {
                throw new Error('ID de catégorie manquant');
              }
              // Mise à jour optimiste
              dispatch(deleteCategory(category.id));

              // Suppression dans la base de données
              await database.deleteCategory(category.id);
            } catch (error) {
              console.error('Erreur:', error);
              Alert.alert('Erreur', 'Impossible de supprimer la catégorie');
              // Recharger les catégories en cas d'erreur
              loadCategories();
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: Category }) => (
    <Animated.View style={[styles.categoryCard, animatedStyle]}>
      <View style={styles.categoryContent}>
        <View style={styles.iconContainer}>
          <MaterialIcons
            name={(item.icon as MaterialIconName) || 'folder'}
            size={24}
            color="#007AFF"
          />
        </View>
        <View style={styles.categoryInfo}>
          <Text style={styles.categoryName}>{item.name}</Text>
          {item.description ? (
            <Text style={styles.categoryDescription} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.categoryActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditCategory(item)}
        >
          <MaterialIcons name="edit" size={20} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteCategory(item)}
        >
          <MaterialIcons name="delete" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Chargement des catégories...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
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

      <View style={styles.header}>
        <Text style={styles.title}>Catégories</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddCategory}
        >
          <MaterialIcons name="add" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Ajouter une catégorie</Text>
        </TouchableOpacity>
      </View>

      {categories.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="category" size={64} color="#ccc" />
          <Text style={styles.emptyStateText}>Aucune catégorie</Text>
          <Text style={styles.emptyStateSubtext}>
            Commencez par créer une nouvelle catégorie
          </Text>
        </View>
      ) : (
        <FlatList
          data={categories}
          renderItem={renderItem}
          keyExtractor={item => item.id?.toString() || Math.random().toString()}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  list: {
    padding: 16,
  },
  categoryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  categoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 14,
    color: '#666',
  },
  categoryActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F0F8FF',
  },
  deleteButton: {
    backgroundColor: '#FFF0F0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 4,
  }
});

export default CategoryScreen;