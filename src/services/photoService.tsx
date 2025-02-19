import { supabase } from '../config/supabase';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { SUPABASE_CONFIG } from '../config/supabaseConfig';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const {
  S3_URL,
  STORAGE: {
    BUCKETS: { PHOTOS },
    MAX_FILE_SIZE,
    CACHE_CONTROL,
    CONTENT_TYPE: { JPEG }
  }
} = SUPABASE_CONFIG;

/**
 * Compresse une image de manière optimale avec une approche progressive :
 * 1. Commence avec une haute qualité et grande taille
 * 2. Réduit progressivement jusqu'à atteindre la taille cible
 * 3. Utilise JPEG pour une meilleure compression
 */
const compressImage = async (uri: string): Promise<string> => {
  const qualitySteps = [0.8, 0.6, 0.4];
  const resizeSteps = [1024, 800, 600];
  
  let resultUri = uri;

  for (let i = 0; i < qualitySteps.length; i++) {
    try {
      const result = await manipulateAsync(
        resultUri,
        [{ resize: { width: resizeSteps[i] } }],
        {
          compress: qualitySteps[i],
          format: SaveFormat.JPEG
        }
      );

      if (Platform.OS !== 'web') {
        const fileInfo = await FileSystem.getInfoAsync(result.uri, { size: true });
        if ('size' in fileInfo && fileInfo.size <= MAX_FILE_SIZE) {
          return result.uri;
        }
      } else if (i > 0) { // Sur le web, on s'arrête après la deuxième tentative
        return result.uri;
      }
      
      resultUri = result.uri;
    } catch (error) {
      console.error(`Échec de la compression étape ${i+1}:`, error);
      if (i > 0) { // Si on a au moins une version compressée, on la retourne
        return resultUri;
      }
    }
  }

  return resultUri;
};

class PhotoService {
  static async getImageUrl(filename: string): Promise<string> {
    try {
      console.log('Génération de l\'URL signée pour:', filename);
      
      // Générer une URL signée qui expire après 1 heure
      const { data, error: signedUrlError } = await supabase.storage
        .from(PHOTOS)
        .createSignedUrl(filename, 3600);
      
      if (signedUrlError) {
        console.error('Erreur lors de la génération de l\'URL signée:', signedUrlError);
        throw signedUrlError;
      }
      
      if (!data?.signedUrl) {
        console.error('URL signée non générée');
        throw new Error('URL signée non générée');
      }

      console.log('URL signée générée avec succès');
      return data.signedUrl;
    } catch (error) {
      console.error('Erreur détaillée lors de la génération de l\'URL:', error);
      if (error instanceof Error) {
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
      }
      throw error;
    }
  }

  // Ajouter un cache local pour les URLs signées
  private static urlCache: Map<string, { url: string; expiry: number }> = new Map();

  static async getImageUrlWithCache(filename: string): Promise<string> {
    const now = Date.now();
    const cached = this.urlCache.get(filename);

    // Si l'URL est en cache et n'a pas expiré (marge de 5 minutes avant expiration)
    if (cached && cached.expiry - now > 300000) {
      return cached.url;
    }

    // Générer une nouvelle URL signée
    const signedUrl = await this.getImageUrl(filename);
    
    // Mettre en cache avec une expiration de 1 heure
    this.urlCache.set(filename, {
      url: signedUrl,
      expiry: now + 3600000
    });

    return signedUrl;
  }

  static async uploadPhoto(uri: string): Promise<string> {
    try {
      console.log('Début du processus d\'upload avec URI:', uri);
      console.log('Bucket utilisé:', PHOTOS);
      
      // Vérifier si l'URI est déjà une URL Supabase Storage
      if (uri.includes(S3_URL)) {
        console.log('URL déjà dans Supabase:', uri);
        const filename = uri.split('/').pop();
        if (filename) {
          return this.getImageUrlWithCache(filename);
        }
        return uri;
      }

      // Compresser l'image
      console.log('Compression de l\'image...');
      const compressedUri = await compressImage(uri);
      console.log('Image compressée avec succès');
      
      const filename = `photo_${Date.now()}.jpg`;
      console.log('Nom du fichier généré:', filename);
      
      if (Platform.OS === 'web') {
        console.log('Upload depuis le web...');
        const response = await fetch(compressedUri);
        const blob = await response.blob();
        
        console.log('Upload vers le bucket', PHOTOS);
        const { data, error } = await supabase.storage
          .from(PHOTOS)
          .upload(filename, blob, {
            cacheControl: CACHE_CONTROL,
            upsert: true,
            contentType: JPEG
          });
          
        if (error) {
          console.error('Erreur Supabase lors de l\'upload:', error);
          throw error;
        }
        
        return this.getImageUrl(filename);
      } else {
        console.log('Upload depuis mobile...');
        const base64 = await FileSystem.readAsStringAsync(compressedUri, {
          encoding: FileSystem.EncodingType.Base64
        });
        
        console.log('Upload vers le bucket', PHOTOS);
        const { data, error } = await supabase.storage
          .from(PHOTOS)
          .upload(filename, Buffer.from(base64, 'base64'), {
            contentType: JPEG,
            cacheControl: CACHE_CONTROL,
            upsert: true
          });
          
        if (error) {
          console.error('Erreur Supabase lors de l\'upload:', error);
          throw error;
        }
        
        return this.getImageUrl(filename);
      }
    } catch (error) {
      console.error('Erreur détaillée lors de l\'upload:', error);
      if (error instanceof Error) {
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
      }
      throw error;
    }
  }

  static async deletePhoto(url: string): Promise<void> {
    try {
      // Vérifier si l'URL est une URL Supabase Storage
      if (!url.includes(S3_URL)) {
        console.log('URL non Supabase, ignorée:', url);
        return;
      }

      // Extraire le nom du fichier de l'URL
      const filename = url.split('/').pop();
      if (!filename) {
        throw new Error('Invalid photo URL');
      }

      console.log('Suppression de la photo:', filename, 'du bucket:', PHOTOS);
      const { error } = await supabase.storage
        .from(PHOTOS)
        .remove([filename]);

      if (error) {
        console.error('Erreur lors de la suppression:', error);
        throw error;
      }
      
      console.log('Photo supprimée avec succès');
    } catch (error) {
      console.error('Error deleting photo:', error);
      throw error;
    }
  }

  static async migrateBase64ToStorage(base64Uri: string): Promise<string> {
    try {
      console.log('Début de la migration de la photo base64...');
      
      // Générer un nom de fichier unique
      const fileName = `photo_${Date.now()}.jpg`;
      console.log('Nom de fichier généré:', fileName);
      
      // Convertir le base64 en Blob
      const response = await fetch(base64Uri);
      const blob = await response.blob();
      console.log('Image base64 convertie en Blob');
      
      // Upload vers Supabase Storage
      const { data, error } = await supabase.storage
        .from(PHOTOS)
        .upload(fileName, blob, {
          contentType: JPEG,
          cacheControl: CACHE_CONTROL
        });
        
      if (error) {
        console.error('Erreur lors de l\'upload vers Supabase:', error);
        throw error;
      }
      
      console.log('Photo uploadée avec succès');
      
      return this.getImageUrl(fileName);
    } catch (error) {
      console.error('Erreur lors de la migration de la photo:', error);
      throw error;
    }
  }
}

export const photoService = PhotoService;
