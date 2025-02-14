import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { database } from '../../src/database/database';
import { Category } from '../../src/types/category';
import { selectCategoryById, editCategory } from '../../src/store/categorySlice';
import type { RootState } from '../../src/store/store';
import { IconSelector } from '../../src/components/IconSelector';
import { MaterialIconName } from '../../src/types/icons';

export default function EditCategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dispatch = useDispatch();
  const categoryId = parseInt(id, 10);
  
  const category = useSelector((state: RootState) => selectCategoryById(state, categoryId));
  
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [selectedIcon, setSelectedIcon] = useState(category?.icon || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!category) {
      Alert.alert('Erreur', 'Catégorie non trouvée');
      router.back();
    }
  }, [category, router]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom de la catégorie est requis');
      return;
    }

    if (!selectedIcon) {
      Alert.alert('Erreur', 'Veuillez sélectionner une icône');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Mise à jour dans la base de données
      await database.updateCategory(categoryId, {
        name: name.trim(),
        description: description.trim(),
        icon: selectedIcon as MaterialIconName
      });

      // Mise à jour dans le store
      dispatch(editCategory({
        id: categoryId,
        name: name.trim(),
        description: description.trim(),
        icon: selectedIcon as MaterialIconName,
        createdAt: category?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      Alert.alert('Succès', 'Catégorie mise à jour avec succès');
      router.back();
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la catégorie:', error);
      setError('Erreur lors de la mise à jour de la catégorie');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Nom</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Nom de la catégorie"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Description de la catégorie"
        placeholderTextColor="#999"
        multiline
        numberOfLines={4}
      />

      <Text style={styles.label}>Icône</Text>
      <IconSelector
        selectedIcon={selectedIcon}
        onSelectIcon={setSelectedIcon}
      />

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      <TouchableOpacity 
        style={styles.saveButton}
        onPress={handleSave}
        disabled={loading}
      >
        <Text style={styles.saveButtonText}>Enregistrer</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
}); 