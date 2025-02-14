import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { database } from '../../src/database/database';
import { addNewCategory } from '../../src/store/categorySlice';
import { IconSelector } from '../../src/components/IconSelector';
import { MaterialIconName } from '../../src/types/icons';

export default function AddCategoryScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      // Ajout dans la base de données
      const categoryId = await database.addCategory({
        name: name.trim(),
        description: description.trim(),
        icon: selectedIcon as MaterialIconName
      });

      // Ajout dans le store
      dispatch(addNewCategory({
        id: categoryId,
        name: name.trim(),
        description: description.trim(),
        icon: selectedIcon as MaterialIconName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      Alert.alert('Succès', 'Catégorie ajoutée avec succès');
      router.back();
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la catégorie:', error);
      setError('Erreur lors de l\'ajout de la catégorie');
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
        <Text style={styles.saveButtonText}>Ajouter</Text>
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