import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Sentry from '@sentry/react-native';
import { supabase } from '../config/supabase';
import { SUPABASE_CONFIG } from '../config/supabaseConfig';
import { MAX_PHOTO_SIZE, ALLOWED_PHOTO_TYPES, PHOTO_COMPRESSION_OPTIONS } from '../constants/photos';

const { STORAGE: { BUCKETS: { PHOTOS } } } = SUPABASE_CONFIG;

// Cache en mémoire pour le web
const memoryCache: { [key: string]: string } = {};

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

  // Fonction pour valider une photo
  const validatePhoto = useCallback(async (uri: string): Promise<boolean> => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
      if (!fileInfo.exists || fileInfo.size === undefined) {
        throw new Error('Le fichier n\'existe pas');
      }

      if (fileInfo.size > MAX_PHOTO_SIZE) {
        throw new Error(`La photo est trop volumineuse (max ${MAX_PHOTO_SIZE / 1024 / 1024}MB)`);
      }

      const extension = uri.split('.').pop()?.toLowerCase() || '';
      const mimeType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;

      if (!ALLOWED_PHOTO_TYPES.includes(mimeType)) {
        throw new Error('Format de photo non supporté');
      }

      return true;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { context: 'photo_validation' },
        extra: { uri }
      });
      return false;
    }
  }, []);

  // Fonction pour compresser une image
  const compressImage = useCallback(async (uri: string): Promise<string> => {
    const { maxWidth, maxHeight, quality } = PHOTO_COMPRESSION_OPTIONS;

    const result = await manipulateAsync(
      uri,
      [{ resize: { width: maxWidth, height: maxHeight } }],
      { compress: quality, format: SaveFormat.JPEG }
    );

    return result.uri;
  }, []);

  // Fonction pour charger une image avec cache
  const loadImage = useCallback(async (uri: string, cacheKey?: string) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Sur le web, utiliser le cache en mémoire
      if (Platform.OS === 'web') {
        const cacheKeyWeb = cacheKey || uri;
        if (memoryCache[cacheKeyWeb]) {
          setState({ uri: memoryCache[cacheKeyWeb], loading: false, error: null });
          return;
        }
        memoryCache[cacheKeyWeb] = uri;
        setState({ uri, loading: false, error: null });
        return;
      }

      // Sur mobile, utiliser le système de fichiers
      const filename = cacheKey || uri.split('/').pop();
      const cacheDir = `${FileSystem.cacheDirectory}image_cache/`;
      const cacheFilePath = `${cacheDir}${filename}`;

      const cacheDirInfo = await FileSystem.getInfoAsync(cacheDir);
      if (!cacheDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(cacheDir);
      }

      const cacheInfo = await FileSystem.getInfoAsync(cacheFilePath);
      if (cacheInfo.exists) {
        setState({ uri: cacheFilePath, loading: false, error: null });
        return;
      }

      await FileSystem.downloadAsync(uri, cacheFilePath);
      setState({ uri: cacheFilePath, loading: false, error: null });
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error('Erreur de chargement')
      }));
    }
  }, []);

  // Fonction pour uploader une photo
  const uploadPhoto = useCallback(async (uri: string): Promise<string> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      if (!await validatePhoto(uri)) {
        throw new Error('Photo invalide');
      }

      const compressedUri = await compressImage(uri);
      const filename = `photo_${Date.now()}.jpg`;

      let blob: Blob;
      if (Platform.OS === 'web') {
        const response = await fetch(compressedUri);
        blob = await response.blob();
      } else {
        const base64 = await FileSystem.readAsStringAsync(compressedUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        blob = Buffer.from(base64, 'base64') as unknown as Blob;
      }

      const { error: uploadError } = await supabase.storage
        .from(PHOTOS)
        .upload(filename, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600'
        });

      if (uploadError) throw uploadError;

      // Utiliser getPublicUrl pour obtenir l'URL correcte
      const { data } = supabase.storage
        .from(PHOTOS)
        .getPublicUrl(filename);

      const publicUrl = data?.publicUrl;
      if (!publicUrl) throw new Error('Échec de la génération de l\'URL publique');

      setState({ uri: publicUrl, loading: false, error: null });
      return publicUrl;
    } catch (error) {
      const finalError = error instanceof Error ? error : new Error('Échec de l\'upload');
      setState(prev => ({ ...prev, loading: false, error: finalError }));
      throw finalError;
    }
  }, [validatePhoto, compressImage]);

  // Fonction pour supprimer une photo
  const deletePhoto = useCallback(async (uri: string): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const filename = uri.split('/').pop();
      if (!filename) throw new Error('URL de photo invalide');

      const { error } = await supabase.storage
        .from(PHOTOS)
        .remove([filename]);

      if (error) throw error;

      setState(prev => ({ ...prev, loading: false, error: null }));
    } catch (error) {
      const finalError = error instanceof Error ? error : new Error('Échec de la suppression');
      setState(prev => ({ ...prev, loading: false, error: finalError }));
      throw finalError;
    }
  }, []);

  return {
    ...state,
    loadImage,
    uploadPhoto,
    deletePhoto,
    validatePhoto
  };
}; 