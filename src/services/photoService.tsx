import { supabase } from '../config/supabase';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { SUPABASE_CONFIG } from '../config/supabaseConfig';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { create } from 'zustand';

const {
  S3_URL,
  STORAGE: {
    BUCKETS: { PHOTOS },
    MAX_FILE_SIZE,
    CACHE_CONTROL,
    CONTENT_TYPE: { JPEG }
  }
} = SUPABASE_CONFIG;

const MAX_SIZE_BYTES = 500 * 1024; // 500KB en bytes

// Store pour gérer l'état de compression
interface CompressionState {
  isCompressing: boolean;
  progress: number;
  setCompressing: (isCompressing: boolean) => void;
  setProgress: (progress: number) => void;
}

export const useCompressionStore = create<CompressionState>((set) => ({
  isCompressing: false,
  progress: 0,
  setCompressing: (isCompressing) => set({ isCompressing }),
  setProgress: (progress) => set({ progress })
}));

/**
 * Compresse une image de manière optimale avec une approche progressive :
 * 1. Commence avec une haute qualité et grande taille
 * 2. Réduit progressivement jusqu'à atteindre la taille cible
 * 3. Utilise JPEG pour une meilleure compression
 */
const compressImage = async (uri: string): Promise<string> => {
  const { setCompressing, setProgress } = useCompressionStore.getState();
  setCompressing(true);
  setProgress(0);
  
  // On définit une largeur cible fixe pour la redimension, par exemple 1024 pixels
  const targetWidth = 1024;
  
  // On utilise une recherche binaire sur le paramètre de compression (entre 0.1 et 1.0)
  let low = 0.1;
  let high = 1.0;
  let candidateUri = uri;
  const maxIterations = 6;
  
  try {
    for (let i = 0; i < maxIterations; i++) {
      const mid = (low + high) / 2;
      setProgress((i / maxIterations) * 100);
      console.log(`Tentative de compression - itération ${i + 1}/${maxIterations} avec qualité = ${mid}`);
      
      const result = await manipulateAsync(
        uri,
        [{ resize: { width: targetWidth } }],
        { compress: mid, format: SaveFormat.JPEG }
      );
      
      if (Platform.OS !== 'web') {
        const fileInfo = await FileSystem.getInfoAsync(result.uri, { size: true });
        if (fileInfo.exists && fileInfo.size !== undefined) {
          console.log(`Taille après compression: ${fileInfo.size / 1024} KB`);
          if (fileInfo.size > MAX_SIZE_BYTES) {
            // Le fichier est trop volumineux, il faut réduire la qualité
            high = mid;
          } else {
            // Le fichier est sous la limite, on garde ce candidat et on tente d'améliorer la qualité
            candidateUri = result.uri;
            low = mid;
          }
        } else {
          candidateUri = result.uri;
          break;
        }
      } else {
        // Pour le web, on ne peut pas vérifier la taille, on utilise le résultat actuel
        candidateUri = result.uri;
        break;
      }
    }
    setProgress(100);
    return candidateUri;
  } catch (error) {
    console.error('Erreur lors de la compression avec recherche binaire:', error);
    throw error;
  } finally {
    setCompressing(false);
  }
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
  private static pendingRequests: Map<string, Promise<string>> = new Map();

  static async getImageUrlWithCache(filename: string): Promise<string> {
    const now = Date.now();
    const cached = this.urlCache.get(filename);

    // Si l'URL est en cache et n'a pas expiré (marge de 5 minutes avant expiration)
    if (cached && cached.expiry - now > 300000) {
      return cached.url;
    }

    // Si une requête est déjà en cours pour cette image, retourner la promesse existante
    const pendingRequest = this.pendingRequests.get(filename);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Créer une nouvelle requête
    const requestPromise = (async () => {
      try {
        const signedUrl = await this.getImageUrl(filename);
        
        // Mettre en cache avec une expiration de 1 heure
        this.urlCache.set(filename, {
          url: signedUrl,
          expiry: now + 3600000
        });

        return signedUrl;
      } finally {
        // Nettoyer la requête en cours une fois terminée
        this.pendingRequests.delete(filename);
      }
    })();

    // Stocker la requête en cours
    this.pendingRequests.set(filename, requestPromise);

    return requestPromise;
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

