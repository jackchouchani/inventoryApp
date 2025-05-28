import { useState, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sentry from '@sentry/react-native';
import { compressImage as compressImageUtil } from '../utils/imageCompression';
import { uploadToR2Worker, deleteFromR2Worker, getImageUrl as getR2ImageUrl } from '../utils/r2Client';
import { MAX_PHOTO_SIZE, ALLOWED_PHOTO_TYPES } from '../constants/photos';

interface PhotoState {
  uri: string | null;
  loading: boolean;
  error: Error | null;
}

export const usePhoto = () => {
  const [state, setState] = useState<PhotoState>({
    uri: null,
    loading: false,
    error: null
  });

  const validatePhoto = useCallback(async (uri: string): Promise<boolean> => {
    try {
      console.log(`[usePhoto] validatePhoto - Début validation: ${uri.substring(0, 50)}...`);

      if (uri.startsWith('file://')) {
        const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
        if (!fileInfo.exists || fileInfo.size === undefined) {
          console.error(`[usePhoto] validatePhoto - Le fichier local n'existe pas: ${uri}`);
          throw new Error('Le fichier n\'existe pas');
        }

        if (fileInfo.size > MAX_PHOTO_SIZE) {
          console.error(`[usePhoto] validatePhoto - Fichier local trop volumineux: ${fileInfo.size/1024/1024}MB (max ${MAX_PHOTO_SIZE/1024/1024}MB)`);
          throw new Error(`La photo est trop volumineuse (max ${MAX_PHOTO_SIZE / 1024 / 1024}MB)`);
        }

        const extension = uri.split('.').pop()?.toLowerCase() || '';
        const mimeType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;

        if (!ALLOWED_PHOTO_TYPES.includes(mimeType)) {
          console.error(`[usePhoto] validatePhoto - Extension locale non supportée: ${extension}, MIME type: ${mimeType}`);
          throw new Error('Format de photo non supporté');
        }
      } else if (uri.startsWith('data:image/')) {
        const mimeMatch = uri.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
        if (!mimeMatch) {
          console.error(`[usePhoto] validatePhoto - Format base64 invalide`);
          throw new Error('Format base64 invalide');
        }
        const mimeType = mimeMatch[1];
        console.log(`[usePhoto] validatePhoto - MIME type détecté: ${mimeType}`);

        if (!ALLOWED_PHOTO_TYPES.includes(mimeType)) {
          console.error(`[usePhoto] validatePhoto - Type de fichier non supporté: ${mimeType}`);
          throw new Error('Format de photo non supporté');
        }

        const base64Data = uri.split(',')[1];
        const approximateSize = (base64Data.length * 3) / 4;

        if (approximateSize > MAX_PHOTO_SIZE) {
          console.error(`[usePhoto] validatePhoto - Image base64 trop volumineuse: ~${(approximateSize/1024/1024).toFixed(2)}MB (max ${MAX_PHOTO_SIZE/1024/1024}MB)`);
          throw new Error(`La photo est trop volumineuse (max ${MAX_PHOTO_SIZE / 1024 / 1024}MB)`);
        }
      } else if (uri.startsWith('blob:') && Platform.OS === 'web') {
        const response = await fetch(uri);
        if (!response.ok) throw new Error(`Failed to fetch blob URL: ${response.status}`);
        const blob = await response.blob();
        if (!ALLOWED_PHOTO_TYPES.includes(blob.type)) throw new Error('Unsupported photo format');
        if (blob.size > MAX_PHOTO_SIZE) throw new Error(`Photo is too large (max ${MAX_PHOTO_SIZE / 1024 / 1024}MB)`);
      } else {
        console.log(`[usePhoto] validatePhoto - URI distante (non validée en taille/type): ${uri.substring(0, 50)}...`);
      }

      return true;
    } catch (error) {
      console.error(`[usePhoto] validatePhoto - Échec:`, error);
      Sentry.captureException(error, {
        tags: { context: 'photo_validation' },
        extra: { uri: uri ? uri.substring(0, 100) + '...' : 'empty uri' }
      });
      Alert.alert('Erreur de validation photo', error instanceof Error ? error.message : String(error));
      return false;
    }
  }, []);

  const compressImage = useCallback(async (uri: string): Promise<string> => {
    console.log(`[usePhoto] compressImage - Début de compression: ${uri.substring(0, 50)}...`);
    try {
      const compressedUri = await compressImageUtil(uri);
      console.log(`[usePhoto] compressImage - Compression terminée.`);
      return compressedUri;
    } catch (error) {
      console.error(`[usePhoto] Erreur lors de la compression:`, error);
      Sentry.captureException(error, {
        tags: { context: 'photo_compression' },
        extra: { uri: uri ? uri.substring(0, 100) + '...' : 'empty uri' }
      });
      Alert.alert('Avertissement', 'La compression de l\'image a échoué. L\'image sera uploadée sans compression.');
      return uri;
    }
  }, []);

  const loadImage = useCallback(async (filename: string): Promise<string | null> => {
    try {
      if (!filename) {
        console.log(`[usePhoto] loadImage - Nom de fichier vide, impossible de charger l'image`);
        setState({ uri: null, loading: false, error: null });
        return null;
      }

      setState({ uri: null, loading: true, error: null });
      console.log(`[usePhoto] loadImage - Début chargement R2: ${filename}`);

      const imageUrl = getR2ImageUrl(filename);
      console.log(`[usePhoto] loadImage - URL R2 générée: ${imageUrl}`);

      setState({ uri: imageUrl, loading: false, error: null });
      return imageUrl;
    } catch (error) {
      console.error(`[usePhoto] loadImage - Erreur chargement R2:`, error);
      Sentry.captureException(error, {
        tags: { context: 'photo_load_r2' },
        extra: { filename }
      });
      const errorMessage = error instanceof Error ? error.message : String(error);
      setState({ uri: null, loading: false, error: new Error(`Impossible de charger l'image: ${errorMessage}`) });
      Alert.alert('Erreur de chargement image', `Impossible de charger l'image ${filename}.`);
      return null;
    }
  }, []);

  const deletePhoto = useCallback(async (filename: string): Promise<void> => {
    try {
      setState({ uri: null, loading: true, error: null });
      if (!filename) {
        console.log(`[usePhoto] deletePhoto - Nom de fichier vide, rien à supprimer.`);
        setState({ uri: null, loading: false, error: null });
        return;
      }
      console.log(`[usePhoto] deletePhoto - Suppression de l'image R2: ${filename}`);
      await deleteFromR2Worker(filename);
      console.log(`[usePhoto] deletePhoto - Suppression R2 réussie: ${filename}`);
      setState({ uri: null, loading: false, error: null });
    } catch (error) {
      console.error(`[usePhoto] deletePhoto - Erreur suppression R2:`, error);
      Sentry.captureException(error, {
        tags: { context: 'photo_delete_r2' },
        extra: { filename }
      });
      const errorMessage = error instanceof Error ? error.message : String(error);
      setState({
        uri: null,
        loading: false,
        error: new Error(`Erreur lors de la suppression de l'image: ${errorMessage}`)
      });
      Alert.alert('Erreur de suppression', `Impossible de supprimer l'image ${filename}.`);
      throw error;
    }
  }, []);

  const uploadPhoto = useCallback(async (uri: string, shouldCompress = true, oldFilename?: string): Promise<string | null> => {
    try {
      setState({ uri: null, loading: true, error: null });

      let processedUri = uri;
      
      // COMPRESSION D'ABORD - avant la validation
      if (shouldCompress) {
        try {
          console.log(`[usePhoto] uploadPhoto - Compression de l'image avant validation...`);
          processedUri = await compressImage(uri);
          console.log(`[usePhoto] uploadPhoto - Compression terminée, validation de l'image compressée...`);
        } catch (compressError) {
          console.warn(`[usePhoto] uploadPhoto - Erreur de compression, utilisation de l'image originale:`, compressError);
          processedUri = uri;
        }
      }

      // VALIDATION APRÈS COMPRESSION - et non-bloquante
      try {
        const isValid = await validatePhoto(processedUri);
        if (!isValid) {
          console.warn(`[usePhoto] uploadPhoto - Validation échouée, mais on continue l'upload...`);
        }
      } catch (validationError) {
        console.warn(`[usePhoto] uploadPhoto - Erreur de validation, mais on continue l'upload:`, validationError);
      }

      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const filename = `item_photo_${timestamp}_${randomId}.jpg`;

      if (oldFilename) {
        console.log(`[usePhoto] uploadPhoto - Suppression de l'ancienne image R2: ${oldFilename}`);
        try {
          await deleteFromR2Worker(oldFilename);
          console.log(`[usePhoto] uploadPhoto - Ancienne image R2 supprimée.`);
        } catch (e) {
          console.warn(`[usePhoto] uploadPhoto - Échec de la suppression de l'ancienne image R2 ${oldFilename}:`, e);
          Sentry.captureException(e, {
            tags: { context: 'photo_old_delete_r2_non_blocking' },
            extra: { filename: oldFilename }
          });
        }
      }

      console.log(`[usePhoto] uploadPhoto - Upload de l'image vers R2: ${filename}`);
      const uploadedFilename = await uploadToR2Worker(processedUri, filename);
      console.log(`[usePhoto] uploadPhoto - Upload R2 terminé, nom retourné: ${uploadedFilename}`);

      if (uploadedFilename) {
        const finalImageUrl = getR2ImageUrl(uploadedFilename);
        setState({ uri: finalImageUrl, loading: false, error: null });
        return uploadedFilename;
      } else {
        console.error(`[usePhoto] uploadPhoto - Le worker R2 n'a pas retourné de nom de fichier.`);
        setState({ uri: null, loading: false, error: new Error("L'upload de la photo a échoué.") });
        Alert.alert('Erreur', "L'upload de la photo vers le serveur a échoué.");
        return null;
      }
    } catch (error) {
      console.error(`[usePhoto] uploadPhoto - Erreur générale lors de l'upload R2:`, error);
      Sentry.captureException(error, {
        tags: { context: 'photo_upload_r2' },
        extra: { uri: uri ? uri.substring(0, 100) + '...' : 'empty uri' }
      });
      const errorMessage = error instanceof Error ? error.message : String(error);
      setState({
        uri: null,
        loading: false,
        error: new Error(`Échec de l'upload de la photo: ${errorMessage}`)
      });
      Alert.alert('Erreur', `Échec de l'upload de la photo: ${errorMessage}`);
      throw error;
    }
  }, [compressImage, deletePhoto, validatePhoto]);

  return { state, loadImage, uploadPhoto, deletePhoto, validatePhoto };
}; 