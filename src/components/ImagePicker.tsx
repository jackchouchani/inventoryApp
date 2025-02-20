import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import * as ExpoImagePicker from 'expo-image-picker';
import { usePermissions } from '../hooks/usePermissions';
import * as Sentry from '@sentry/react-native';

interface ImagePickerProps {
  onImageSelected: (uri: string) => void;
  onError: (error: string) => void;
}

export const ImagePicker: React.FC<ImagePickerProps> = ({ onImageSelected, onError }) => {
  const { requestPermission } = usePermissions();

  const pickImage = async () => {
    try {
      const hasPermission = await requestPermission('mediaLibrary');
      if (!hasPermission) {
        onError('Permission d\'accès à la galerie non accordée');
        return;
      }

      const result = await ExpoImagePicker.launchImageLibraryAsync({
        mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        onImageSelected(result.assets[0].uri);
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { context: 'image_picker' }
      });
      onError('Erreur lors de la sélection de l\'image');
    }
  };

  return (
    <TouchableOpacity style={styles.button} onPress={pickImage}>
      <Text style={styles.buttonText}>Sélectionner une image</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 