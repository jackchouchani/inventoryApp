import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  StyleSheet,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../src/store/store';
import { deleteCategory, editCategory, resetCategories, setCategories, addNewCategory } from '../../src/store/categorySlice';
import { getCategories as fetchCategories, addCategory as addCategoryToDatabase, updateCategory, deleteCategory as deleteCategoryFromDB, Category } from '../../src/database/database';
import { theme } from '../../src/utils/theme';
import { useRefreshStore } from '../../src/store/refreshStore';
import Icon from 'react-native-vector-icons/MaterialIcons';

const CategoryScreen = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const dispatch = useDispatch();
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const dbCategories = await fetchCategories();
        const formattedCategories = dbCategories.map(cat => ({
          id: cat.id!,
          name: cat.name,
          createdAt: cat.createdAt,
          updatedAt: cat.updatedAt
        }));
        dispatch(setCategories(formattedCategories));
      } catch (error) {
        console.error('Error loading categories:', error);
        setError('Failed to load categories');
      }
    };
    
    loadCategories();
  }, [dispatch]);

  const categories = useSelector((state: RootState) => state.categories.categories);

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) {
      Alert.alert('Erreur', 'Le nom de la catégorie est requis');
      return;
    }

    try {
      const now = new Date().toISOString();
      const tempId = Date.now(); // ID temporaire pour l'optimistic update
      const optimisticCategory = {
        id: tempId,
        name: newCategory.name.trim(),
        description: newCategory.description.trim(),
        createdAt: now,
        updatedAt: now
      };

      // Optimistic update
      dispatch(addNewCategory(optimisticCategory));
      setModalVisible(false);

      // Effectuer l'opération Supabase
      const categoryId = await addCategoryToDatabase({
        name: newCategory.name.trim(),
        description: newCategory.description.trim()
      });

      // Mettre à jour l'ID avec celui de la base de données
      const realCategory = {
        ...optimisticCategory,
        id: categoryId
      };
      dispatch(setCategories([...categories.filter(c => c.id !== tempId), realCategory]));
      
      setNewCategory({ name: '', description: '' });
      Alert.alert('Succès', 'Catégorie ajoutée avec succès');
    } catch (error) {
      console.error('Erreur:', error);
      // Rollback en cas d'erreur
      dispatch(setCategories(categories));
      Alert.alert('Erreur', 'Impossible d\'ajouter la catégorie. Veuillez réessayer.');
    }
  };

  const handleEditCategory = async (id: string, newName: string) => {
    if (!newName.trim()) {
      setError('Le nom de la catégorie ne peut pas être vide');
      return;
    }

    const originalCategories = [...categories];
    try {
      // Optimistic update
      dispatch(editCategory({ id: parseInt(id), name: newName.trim() }));
      setModalVisible(false);
      setCategoryName('');
      setEditingId(null);

      // Effectuer l'opération Supabase
      await updateCategory(parseInt(id), newName.trim());
    } catch (error) {
      // Rollback en cas d'erreur
      dispatch(setCategories(originalCategories));
      Alert.alert('Erreur', 'Impossible de modifier la catégorie. Veuillez réessayer.');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const originalCategories = [...categories];
    Alert.alert(
      'Supprimer la catégorie',
      'Êtes-vous sûr de vouloir supprimer cette catégorie ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          onPress: async () => {
            try {
              // Optimistic update
              dispatch(deleteCategory(parseInt(id)));

              // Effectuer l'opération Supabase
              await deleteCategoryFromDB(parseInt(id));
            } catch (error) {
              // Rollback en cas d'erreur
              dispatch(setCategories(originalCategories));
              Alert.alert('Erreur', 'Impossible de supprimer la catégorie. Veuillez réessayer.');
            }
          },
          style: 'destructive'
        },
      ]
    );
  };

  const handleSubmit = () => {
    if (!categoryName.trim()) {
      setError('Category name cannot be empty');
      return;
    }

    if (editingId) {
      dispatch(editCategory({ id: parseInt(editingId), name: categoryName.trim() }));
    } else {
      // Créer un objet Category complet au lieu d'une simple chaîne
      const now = new Date().toISOString();
      dispatch(addNewCategory({
        id: Date.now(), // ID temporaire
        name: categoryName.trim(),
        createdAt: now,
        updatedAt: now
      }));
    }

    setModalVisible(false);
    setCategoryName('');
    setEditingId(null);
    setError('');
  };

  const handleResetCategories = () => {
    Alert.alert(
      'Reset Categories',
      'Are you sure you want to reset all categories? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => dispatch(resetCategories()),
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Category }) => (
    <View style={styles.categoryItem}>
      <Text style={styles.categoryName}>{item.name}</Text>
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditCategory(item.id!.toString(), item.name)}
        >
          <Icon name="edit" size={20} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteCategory(item.id!.toString())}
        >
          <Icon name="delete" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gestion des Catégories</Text>
      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.addButtonText}>+ Ajouter une catégorie</Text>
      </TouchableOpacity>

      <FlatList
        data={categories}
        renderItem={renderItem}
        keyExtractor={item => item.id?.toString() || Math.random().toString()}
        style={styles.list}
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TextInput
              style={styles.input}
              placeholder="Nom de la catégorie"
              value={newCategory.name}
              onChangeText={(text) => setNewCategory(prev => ({ ...prev, name: text }))}
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description"
              value={newCategory.description}
              onChangeText={(text) => setNewCategory(prev => ({ ...prev, description: text }))}
              multiline
            />

            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setNewCategory({ name: '', description: '' });
                }}
              >
                <Text style={styles.buttonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.submitButton]}
                onPress={handleAddCategory}
              >
                <Text style={styles.buttonText}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  categoryItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  categoryName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 20,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default CategoryScreen;