import React, { useState, useEffect } from 'react';
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
  Animated,
  SafeAreaView,
  Platform
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../src/store/store';
import { deleteCategory, editCategory, setCategories, addNewCategory } from '../../src/store/categorySlice';
import { getCategories as fetchCategories, addCategory as addCategoryToDatabase, updateCategory, deleteCategory as deleteCategoryFromDB, Category } from '../../src/database/database';
import { MaterialIcons } from '@expo/vector-icons';
import { useAnimatedComponents } from '../../src/hooks/useAnimatedComponents';

const CategoryScreen = () => {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  const categories = useSelector((state: RootState) => 
    Object.values(state.categories.entities) as Category[]
  );

  const {
    opacity,
    fadeIn,
    fadeOut,
    fadeStyle,
    scale,
    scaleUp,
    scaleDown,
    scaleStyle
  } = useAnimatedComponents();

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (editingCategory) {
      setFormData({
        name: editingCategory.name,
        description: editingCategory.description || ''
      });
    } else {
      setFormData({ name: '', description: '' });
    }
  }, [editingCategory]);

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const dbCategories = await fetchCategories();
      const formattedCategories = dbCategories.map(cat => ({
        id: cat.id!,
        name: cat.name,
        description: cat.description,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt
      }));
      dispatch(setCategories(formattedCategories));
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error);
      Alert.alert('Erreur', 'Impossible de charger les catégories');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Le nom de la catégorie est requis');
      return;
    }

    setError('');
    const now = new Date().toISOString();

    try {
      if (editingCategory) {
        // Mise à jour optimiste pour l'édition
        const updatedCategory = {
          id: editingCategory.id,
          name: formData.name.trim(),
          description: formData.description.trim(),
          updatedAt: now
        };
        dispatch(editCategory({ id: editingCategory.id, name: formData.name.trim() }));
        
        // Mise à jour dans la base de données
        await updateCategory(editingCategory.id, formData.name.trim(), formData.description.trim());
      } else {
        // Mise à jour optimiste pour l'ajout
        const tempId = Date.now();
        const newCategory = {
          id: tempId,
          name: formData.name.trim(),
          description: formData.description.trim(),
          createdAt: now,
          updatedAt: now
        };
        dispatch(addNewCategory(newCategory));

        // Ajout dans la base de données
        const categoryId = await addCategoryToDatabase({
          name: formData.name.trim(),
          description: formData.description.trim()
        });

        // Mise à jour avec l'ID réel
        dispatch(setCategories([
          ...categories.filter(c => c.id !== tempId),
          { ...newCategory, id: categoryId }
        ]));
      }

      setModalVisible(false);
      setEditingCategory(null);
      setFormData({ name: '', description: '' });
    } catch (error) {
      console.error('Erreur:', error);
      Alert.alert(
        'Erreur',
        editingCategory 
          ? 'Impossible de modifier la catégorie'
          : 'Impossible d\'ajouter la catégorie'
      );
    }
  };

  const handleDeleteCategory = (category: Category) => {
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
              // Mise à jour optimiste
              dispatch(deleteCategory(category.id));
              
              // Suppression dans la base de données
              await deleteCategoryFromDB(category.id);
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
    <Animated.View style={[styles.categoryCard, fadeStyle, scaleStyle]}>
      <View style={styles.categoryContent}>
        <Text style={styles.categoryName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.categoryDescription}>{item.description}</Text>
        )}
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => {
            setEditingCategory(item);
            setModalVisible(true);
          }}
        >
          <MaterialIcons name="edit" size={22} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteCategory(item)}
        >
          <MaterialIcons name="delete" size={22} color="#FF3B30" />
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Catégories</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            setEditingCategory(null);
            setModalVisible(true);
          }}
        >
          <MaterialIcons name="add" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Nouvelle catégorie</Text>
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
          keyExtractor={item => item.id!.toString() || Math.random().toString()}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setModalVisible(false);
          setEditingCategory(null);
          setFormData({ name: '', description: '' });
          setError('');
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => {
                  setModalVisible(false);
                  setEditingCategory(null);
                  setFormData({ name: '', description: '' });
                  setError('');
                }}
              >
                <Text style={styles.modalCloseButtonText}>Annuler</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
              </Text>
              <View style={styles.modalHeaderSpacer} />
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Nom</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(text) => {
                    setFormData(prev => ({ ...prev, name: text }));
                    setError('');
                  }}
                  placeholder="Nom de la catégorie"
                  placeholderTextColor="#999"
                />
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                  placeholder="Description (optionnelle)"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <TouchableOpacity 
                style={styles.submitButton}
                onPress={handleSubmit}
              >
                <Text style={styles.submitButtonText}>
                  {editingCategory ? 'Mettre à jour' : 'Créer'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  categoryContent: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 14,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  editButton: {
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  modalHeaderSpacer: {
    width: 50,
  },
  formContainer: {
    padding: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
});

export default CategoryScreen;