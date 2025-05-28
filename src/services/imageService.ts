import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '../database/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'react-native';

const IMAGE_CACHE_PREFIX = '@app_image_cache:';
const IMAGE_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 jours
const THUMBNAIL_SIZE = 200;
const FULL_IMAGE_MAX_WIDTH = 1024;
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100 MB

interface ImageDimensions {
  width: number;
  height: number;
}

interface CacheInfo {
  uri: string;
  timestamp: number;
  size: number;
}

class ImageServiceClass {
  private cacheSize: number = 0;
  private cacheInitialized: boolean = false;

  // Initialise le cache et calcule la taille totale
  private async initializeCache(): Promise<void> {
    if (this.cacheInitialized) return;

    try {
      const keys = await AsyncStorage.getAllKeys();
      const imageCacheKeys = keys.filter(key => key.startsWith(IMAGE_CACHE_PREFIX));
      
      let totalSize = 0;
      for (const key of imageCacheKeys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          const { uri } = JSON.parse(cached);
          const fileInfo = await FileSystem.getInfoAsync(uri);
          if (fileInfo.exists) {
            totalSize += fileInfo.size || 0;
          } else {
            await AsyncStorage.removeItem(key);
          }
        }
      }
      
      this.cacheSize = totalSize;
      this.cacheInitialized = true;
    } catch (error) {
      console.warn('Erreur lors de l\'initialisation du cache:', error);
    }
  }

  // Gère la taille du cache
  private async manageCacheSize(newFileSize: number): Promise<void> {
    if (this.cacheSize + newFileSize > MAX_CACHE_SIZE) {
      const keys = await AsyncStorage.getAllKeys();
      const imageCacheKeys = keys.filter(key => key.startsWith(IMAGE_CACHE_PREFIX));
      
      // Récupérer les infos du cache
      const cacheInfos: { key: string; info: CacheInfo }[] = [];
      for (const key of imageCacheKeys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          cacheInfos.push({ key, info: JSON.parse(cached) });
        }
      }
      
      // Trier par date (plus ancien en premier)
      cacheInfos.sort((a, b) => a.info.timestamp - b.info.timestamp);
      
      // Supprimer les fichiers jusqu'à avoir assez d'espace
      for (const { key, info } of cacheInfos) {
        if (this.cacheSize + newFileSize <= MAX_CACHE_SIZE) break;
        
        await FileSystem.deleteAsync(info.uri, { idempotent: true });
        await AsyncStorage.removeItem(key);
        this.cacheSize -= info.size;
      }
    }
  }

  async getImage(path: string, useThumbnail: boolean = false): Promise<string> {
    await this.initializeCache();
    const cacheKey = `${IMAGE_CACHE_PREFIX}${path}${useThumbnail ? '_thumb' : ''}`;
    
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const { uri, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < IMAGE_CACHE_DURATION) {
          const fileInfo = await FileSystem.getInfoAsync(uri);
          if (fileInfo.exists) {
            return uri;
          }
        }
      }
    } catch (error) {
      console.warn('Erreur de lecture du cache:', error);
    }

    const { data, error } = await supabase.storage
      .from('images')
      .download(path);

    if (error) throw error;

    const localUri = FileSystem.documentDirectory + path.replace(/\//g, '_');
    const fr = new FileReader();
    fr.readAsArrayBuffer(data);
    await new Promise((resolve) => {
      fr.onload = async () => {
        await FileSystem.writeAsStringAsync(
          localUri,
          Buffer.from(fr.result as ArrayBuffer).toString('base64'),
          { encoding: FileSystem.EncodingType.Base64 }
        );
        resolve(null);
      };
    });

    let finalUri = localUri;
    if (useThumbnail || path.includes('full_')) {
      const dimensions = await this.getImageDimensions(localUri);
      const targetSize = useThumbnail ? THUMBNAIL_SIZE : FULL_IMAGE_MAX_WIDTH;
      
      if (dimensions.width > targetSize || dimensions.height > targetSize) {
        const manipResult = await manipulateAsync(
          localUri,
          [{ 
            resize: {
              width: targetSize,
              height: targetSize
            }
          }],
          { compress: 0.8, format: SaveFormat.JPEG }
        );
        finalUri = manipResult.uri;
        await FileSystem.deleteAsync(localUri, { idempotent: true });
      }
    }

    const fileInfo = await FileSystem.getInfoAsync(finalUri);
    if (fileInfo.exists) {
      await this.manageCacheSize(fileInfo.size || 0);
      this.cacheSize += fileInfo.size || 0;
      
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        uri: finalUri,
        timestamp: Date.now(),
        size: fileInfo.size
      }));
    }

    return finalUri;
  }

  async uploadImage(uri: string, type: 'item' | 'container'): Promise<string> {
    const manipResult = await manipulateAsync(
      uri,
      [{ 
        resize: {
          width: FULL_IMAGE_MAX_WIDTH,
          height: FULL_IMAGE_MAX_WIDTH
        }
      }],
      { compress: 0.8, format: SaveFormat.JPEG }
    );

    const thumbResult = await manipulateAsync(
      uri,
      [{ 
        resize: {
          width: THUMBNAIL_SIZE,
          height: THUMBNAIL_SIZE
        }
      }],
      { compress: 0.8, format: SaveFormat.JPEG }
    );

    const timestamp = Date.now();
    const fullPath = `${type}s/full_${timestamp}.jpg`;
    const thumbPath = `${type}s/thumb_${timestamp}.jpg`;

    const [fullUpload, thumbUpload] = await Promise.all([
      this.uploadFile(manipResult.uri, fullPath),
      this.uploadFile(thumbResult.uri, thumbPath)
    ]);

    if (fullUpload.error) throw fullUpload.error;
    if (thumbUpload.error) throw thumbUpload.error;

    return fullPath;
  }

  async deleteImage(path: string): Promise<void> {
    const thumbPath = path.replace('full_', 'thumb_');

    await Promise.all([
      supabase.storage.from('images').remove([path]),
      supabase.storage.from('images').remove([thumbPath])
    ]);

    const cacheKeys = [
      `${IMAGE_CACHE_PREFIX}${path}`,
      `${IMAGE_CACHE_PREFIX}${path}_thumb`
    ];

    for (const key of cacheKeys) {
      try {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          const { uri, size } = JSON.parse(cached);
          await FileSystem.deleteAsync(uri, { idempotent: true });
          await AsyncStorage.removeItem(key);
          this.cacheSize -= size;
        }
      } catch (error) {
        console.warn('Erreur lors de la suppression du cache:', error);
      }
    }
  }

  async clearImageCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const imageCacheKeys = keys.filter(key => key.startsWith(IMAGE_CACHE_PREFIX));

      for (const key of imageCacheKeys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          const { uri } = JSON.parse(cached);
          await FileSystem.deleteAsync(uri, { idempotent: true });
          await AsyncStorage.removeItem(key);
        }
      }
      
      this.cacheSize = 0;
    } catch (error) {
      console.error('Erreur lors du nettoyage du cache:', error);
    }
  }

  async uploadFile(uri: string, path: string) {
    const response = await fetch(uri);
    const blob = await response.blob();
    return await supabase.storage.from('images').upload(path, blob);
  }

  async getImageDimensions(uri: string): Promise<ImageDimensions> {
    return new Promise((resolve, reject) => {
      Image.getSize(
        uri,
        (width: number, height: number) => resolve({ width, height }),
        reject
      );
    });
  }
}

export const imageService = new ImageServiceClass(); 