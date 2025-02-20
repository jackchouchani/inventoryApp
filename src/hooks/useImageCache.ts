import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sentry from '@sentry/react-native';
import { isValidImageUri } from '../utils/imageValidation';

interface UseImageCacheResult {
  imagePath: string | null;
  loading: boolean;
  error: boolean;
}

// Cache en mémoire pour le web
const memoryCache: { [key: string]: string } = {};

export const useImageCache = (uri?: string, cacheKey?: string): UseImageCacheResult => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imagePath, setImagePath] = useState<string | null>(null);

  useEffect(() => {
    const loadImage = async () => {
      if (!uri) {
        setLoading(false);
        setError(true);
        return;
      }

      if (!isValidImageUri(uri)) {
        setLoading(false);
        setError(true);
        Sentry.captureMessage('URI d\'image invalide', {
          level: 'warning',
          extra: { uri }
        });
        return;
      }

      try {
        setLoading(true);
        setError(false);

        // Sur le web, on utilise directement l'URI avec un cache en mémoire simple
        if (Platform.OS === 'web') {
          const cacheKeyWeb = cacheKey || uri;
          
          if (memoryCache[cacheKeyWeb]) {
            setImagePath(memoryCache[cacheKeyWeb]);
          } else {
            // Vérifier si l'image peut être chargée
            const img = new Image();
            img.onload = () => {
              memoryCache[cacheKeyWeb] = uri;
              setImagePath(uri);
              setLoading(false);
            };
            img.onerror = () => {
              setError(true);
              setLoading(false);
            };
            img.src = uri;
          }
          return;
        }

        // Sur mobile, on utilise expo-file-system
        const filename = cacheKey || uri.split('/').pop();
        const cacheFilePath = `${FileSystem.cacheDirectory}image_cache/${filename}`;

        // Créer le dossier de cache si nécessaire
        const cacheDir = `${FileSystem.cacheDirectory}image_cache`;
        const cacheDirInfo = await FileSystem.getInfoAsync(cacheDir);
        if (!cacheDirInfo.exists) {
          await FileSystem.makeDirectoryAsync(cacheDir);
        }

        // Vérifier si l'image est déjà en cache
        const cacheInfo = await FileSystem.getInfoAsync(cacheFilePath);
        
        if (cacheInfo.exists) {
          setImagePath(cacheFilePath);
          setLoading(false);
          return;
        }

        // Télécharger et mettre en cache
        await FileSystem.downloadAsync(uri, cacheFilePath);
        setImagePath(cacheFilePath);
      } catch (e) {
        Sentry.captureException(e, {
          tags: { context: 'image_cache_load' },
          extra: { uri, cacheKey, platform: Platform.OS }
        });
        console.error('Erreur lors du chargement de l\'image:', e);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [uri, cacheKey]);

  return { imagePath, loading, error };
}; 