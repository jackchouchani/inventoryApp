import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Item, Container, Category } from '../database/database';
import { savePhoto } from '../utils/photoManager';
import { theme } from '../utils/theme';
import { ActivityIndicator } from 'react-native';

interface ItemFormProps {
  item?: Item;
  onSubmit: (item: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>) => void;
  containers: Container[];
  categories: Category[];
}

export const ItemForm: React.FC<ItemFormProps> = ({ item, onSubmit, containers, categories }) => {
  const [name, setName] = useState(item?.name || '');
  const [purchasePrice, setPurchasePrice] = useState(item?.purchasePrice?.toString() || '');
  const [sellingPrice, setSellingPrice] = useState(item?.sellingPrice?.toString() || '');
  const [photoUri, setPhotoUri] = useState(item?.photoUri || '');
  const [containerId, setContainerId] = useState(item?.containerId || null);
  const [categoryId, setCategoryId] = useState(item?.categoryId || null);

  const pickImage = async () => {
    try {
      // Request camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        console.error('Camera permission not granted');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });
    
      if (!result.canceled) {
        // Save and compress the photo
        const savedUri = await savePhoto(result.assets[0].uri);
        setPhotoUri(savedUri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const [validationError, setValidationError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setValidationError('');
    
    if (!name.trim()) {
      setValidationError('Name is required');
      return;
    }
    if (!purchasePrice) {
      setValidationError('Purchase price is required');
      return;
    }
    if (!sellingPrice) {
      setValidationError('Selling price is required');
      return;
    }
    if (!containerId) {
      setValidationError('Container is required');
      return;
    }
    if (!categoryId) {
      setValidationError('Category is required');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        name: name.trim(),
        purchasePrice: parseFloat(purchasePrice),
        sellingPrice: parseFloat(sellingPrice),
        status: 'available',
        photoUri: photoUri || undefined,
        containerId,
        categoryId,
      });
    } catch (error) {
      setValidationError('Failed to save item. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        {validationError ? (
          <Text style={styles.errorText}>{validationError}</Text>
        ) : null}
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Item name"
        />

        <Text style={styles.label}>Purchase Price</Text>
        <TextInput
          style={styles.input}
          value={purchasePrice}
          onChangeText={setPurchasePrice}
          keyboardType="numeric"
          placeholder="0.00"
        />

        <Text style={styles.label}>Selling Price</Text>
        <TextInput
          style={styles.input}
          value={sellingPrice}
          onChangeText={setSellingPrice}
          keyboardType="numeric"
          placeholder="0.00"
        />

        <Text style={styles.label}>Photo</Text>
        <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.image} />
          ) : (
            <Text>Take Photo</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Container</Text>
        <View style={styles.pickerContainer}>
          {containers.map((container) => (
            <TouchableOpacity
              key={container.id}
              style={[styles.pickerItem, containerId === container.id && styles.pickerItemSelected]}
              onPress={() => setContainerId(container.id as number)}
            >
              <Text>{container.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Category</Text>
        <View style={styles.pickerContainer}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[styles.pickerItem, categoryId === category.id && styles.pickerItemSelected]}
              onPress={() => setCategoryId(category.id as number)}
            >
              <Text>{category.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity 
          style={[styles.submitButton, isSubmitting && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={theme.colors.text.inverse} />
          ) : (
            <Text style={styles.submitButtonText}>Save Item</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  form: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  imageButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    marginBottom: 15,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 5,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  pickerItem: {
    padding: 10,
    margin: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
  },
  pickerItemSelected: {
    backgroundColor: '#e3e3e3',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },
});