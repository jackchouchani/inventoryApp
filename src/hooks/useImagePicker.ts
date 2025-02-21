import { useState, useCallback } from 'react';
import * as ExpoImagePicker from 'expo-image-picker';
import * as Sentry from '@sentry/react-native';
import { usePermissions } from './usePermissions';
import { useNetworkStatus } from './useNetworkStatus';
import { Platform } from 'react-native';

interface UseImagePickerOptions {
  quality?: number;
  allowsEditing?: boolean;
  aspect?: [number, number];
}

interface UseImagePickerResult {
  pickImage: () => Promise<string | null>;
  isLoading: boolean;
  error: string | null;
}

export const useImagePicker = (options: UseImagePickerOptions = {}): UseImagePickerResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { requestPermission } = usePermissions();
  const { isConnected } = useNetworkStatus();

  const pickImage = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Vérification de la connexion pour Sentry
      if (!isConnected) {
        Sentry.addBreadcrumb({
          category: 'image_picker',
          message: 'Tentative de sélection d\'image en mode hors ligne',
          level: 'info'
        });
      }

      const hasPermission = await requestPermission('mediaLibrary');
      if (!hasPermission) {
        setError('Permission d\'accès à la galerie non accordée');
        return null;
      }

      const result = await ExpoImagePicker.launchImageLibraryAsync({
        mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
        allowsEditing: options.allowsEditing ?? true,
        aspect: options.aspect ?? [4, 3],
        quality: options.quality ?? (Platform.OS === 'web' ? 1 : 0.8),
        base64: Platform.OS === 'web',
      });

      if (!result.canceled && result.assets[0]) {
        return result.assets[0].uri;
      }

      return null;
    } catch (error) {
      const errorMessage = 'Erreur lors de la sélection de l\'image';
      setError(errorMessage);
      
      Sentry.captureException(error, {
        tags: { 
          context: 'image_picker',
          platform: Platform.OS
        },
        extra: { options }
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [requestPermission, isConnected, options]);

  return {
    pickImage,
    isLoading,
    error
  };
}; 