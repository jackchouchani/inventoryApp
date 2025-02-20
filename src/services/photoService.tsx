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
const TARGET_SIZE_BYTES = 500 * 1024; // 500KB
const MAX_ALLOWED_SIZE_BYTES = 1 * 1024 * 1024; // 1MB

// Store pour gérer l'état de compression
interface CompressionState {
  isCompressing: boolean;
  progress: number;
  error: Error | null;
  setCompressing: (isCompressing: boolean) => void;
  setProgress: (progress: number) => void;
  setError: (error: Error | null) => void;
}

export const useCompressionStore = create<CompressionState>((set) => ({
  isCompressing: false,
  progress: 0,
  error: null,
  setCompressing: (isCompressing) => set({ isCompressing }),
  setProgress: (progress) => set({ progress }),
  setError: (error) => set({ error })
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

  const TARGET_SIZE_BYTES = 500 * 1024; // 500KB cible
  const MAX_ALLOWED_SIZE_BYTES = 2 * 1024 * 1024; // 2MB max (ajusté pour Supabase)
  const MIN_QUALITY = 0.1;
  const MAX_QUALITY = 0.95;
  const MAX_ITERATIONS = 5;

  let candidateUri = uri;
  let low = MIN_QUALITY;
  let high = MAX_QUALITY;
  let resizeWidth = 1280; // Largeur initiale
  let bestCandidate = { uri: uri, size: Infinity };

  try {
    // Étape 1 : Vérifier la taille initiale
    let initialSize: number;
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      initialSize = blob.size;
      console.log(`Taille initiale (web): ${(initialSize / 1024).toFixed(2)} KB`);
    } else {
      const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
      if (!fileInfo.exists) throw new Error('File does not exist');
      initialSize = (fileInfo as any).size || 0;
      console.log(`Taille initiale (mobile): ${(initialSize / 1024).toFixed(2)} KB`);
    }

    // Ajuster la largeur initiale en fonction de la taille
    if (initialSize > 5 * 1024 * 1024) { // > 5MB
      resizeWidth = 800; // Plus agressif pour les grandes images
      console.log(`Image très grande, réduction initiale à ${resizeWidth}px`);
    } else if (initialSize > 2 * 1024 * 1024) { // > 2MB
      resizeWidth = 1024;
      console.log(`Image grande, réduction initiale à ${resizeWidth}px`);
    }

    // Étape 2 : Compression avec recherche binaire
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const quality = (low + high) / 2;
      setProgress((i / MAX_ITERATIONS) * 100);

      console.log(`Compression - itération ${i + 1}/${MAX_ITERATIONS}, qualité = ${quality.toFixed(2)}, largeur = ${resizeWidth}px`);

      let result;
      if (Platform.OS === 'web') {
        // Workaround pour le web : utiliser canvas si manipulateAsync échoue
        result = await webCompressImage(candidateUri, resizeWidth, quality);
      } else {
        result = await manipulateAsync(
          candidateUri,
          [{ resize: { width: resizeWidth } }],
          { compress: quality, format: SaveFormat.JPEG }
        );
      }

      let fileSize: number;
      if (Platform.OS === 'web') {
        const response = await fetch(result.uri);
        const blob = await response.blob();
        fileSize = blob.size;
      } else {
        const fileInfo = await FileSystem.getInfoAsync(result.uri, { size: true });
        if (!fileInfo.exists || fileInfo.size === undefined) {
          throw new Error('Impossible de déterminer la taille du fichier');
        }
        fileSize = fileInfo.size;
      }

      console.log(`Taille obtenue: ${(fileSize / 1024).toFixed(2)} KB`);

      // Vérifier si la compression est efficace
      if (fileSize >= initialSize && i > 0) {
        console.warn('Compression inefficace, réduction supplémentaire de la résolution');
        resizeWidth = Math.max(400, resizeWidth * 0.7); // Réduction plus forte (30%)
        low = MIN_QUALITY;
        high = MAX_QUALITY;
        continue;
      }

      // Mettre à jour le meilleur candidat
      if (fileSize <= MAX_ALLOWED_SIZE_BYTES && Math.abs(fileSize - TARGET_SIZE_BYTES) < Math.abs(bestCandidate.size - TARGET_SIZE_BYTES)) {
        bestCandidate = { uri: result.uri, size: fileSize };
      }

      // Ajuster les bornes
      if (fileSize > MAX_ALLOWED_SIZE_BYTES) {
        high = quality;
      } else if (fileSize < TARGET_SIZE_BYTES && quality < MAX_QUALITY) {
        low = quality;
      } else {
        candidateUri = result.uri;
        break;
      }

      initialSize = fileSize; // Mettre à jour pour la prochaine vérification
    }

    // Sélectionner le meilleur candidat
    if (bestCandidate.size <= MAX_ALLOWED_SIZE_BYTES && bestCandidate.size !== Infinity) {
      candidateUri = bestCandidate.uri;
      console.log(`Meilleur candidat sélectionné: ${(bestCandidate.size / 1024).toFixed(2)} KB`);
    } else {
      throw new Error(`Impossible de compresser l'image sous ${MAX_ALLOWED_SIZE_BYTES / 1024 / 1024}MB`);
    }

    setProgress(100);
    return candidateUri;
  } catch (error) {
    console.error('Erreur lors de la compression:', error);
    throw error;
  } finally {
    setCompressing(false);
  }
};

// Fonction de compression alternative pour le web
const webCompressImage = async (uri: string, width: number, quality: number): Promise<{ uri: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Impossible de créer le contexte canvas"));
        return;
      }

      // Maintenir le ratio d'aspect
      const aspectRatio = img.height / img.width;
      canvas.width = width;
      canvas.height = width * aspectRatio;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve({ uri: dataUrl });
    };
    img.onerror = () => reject(new Error("Erreur de chargement de l'image"));
    img.src = uri;
  });
};

class PhotoService {
  static async getImageUrl(filename: string): Promise<string> {
    try {
      console.log("Génération de l'URL signée pour:", filename);
      
      // Générer une URL signée qui expire après 1 heure
      const { data, error: signedUrlError } = await supabase.storage
        .from(PHOTOS)
        .createSignedUrl(filename, 3600);
      
      if (signedUrlError) {
        console.error("Erreur lors de la génération de l'URL signée:", signedUrlError);
        throw signedUrlError;
      }
      
      if (!data?.signedUrl) {
        console.error("URL signée non générée");
        throw new Error("URL signée non générée");
      }

      console.log("URL signée générée avec succès");
      return data.signedUrl;
    } catch (error) {
      console.error("Erreur détaillée lors de la génération de l'URL:", error);
      if (error instanceof Error) {
        console.error("Message:", error.message);
        console.error("Stack:", error.stack);
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
      console.log("Début de l'upload avec URI:", uri);
  
      if (uri.includes(S3_URL)) {
        const filename = uri.split('/').pop();
        if (filename) return this.getImageUrlWithCache(filename);
        return uri;
      }
  
      const compressedUri = await compressImage(uri);
      const filename = `photo_${Date.now()}.jpg`;
  
      let blob: Blob;
      if (Platform.OS === 'web') {
        const response = await fetch(compressedUri);
        blob = await response.blob();
        console.log(`Taille avant upload (web): ${(blob.size / 1024).toFixed(2)} KB`);
  
        // Vérification explicite de la taille
        if (blob.size > 2 * 1024 * 1024) {
          throw new Error(`Fichier trop volumineux après compression: ${(blob.size / 1024).toFixed(2)} KB`);
        }
  
        const { error } = await supabase.storage
          .from(PHOTOS)
          .upload(filename, blob, {
            cacheControl: CACHE_CONTROL,
            upsert: true,
            contentType: JPEG,
          });
  
        if (error) throw error;
      } else {
        const base64 = await FileSystem.readAsStringAsync(compressedUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const buffer = Buffer.from(base64, 'base64');
        console.log(`Taille avant upload (mobile): ${(buffer.length / 1024).toFixed(2)} KB`);
  
        if (buffer.length > 2 * 1024 * 1024) {
          throw new Error(`Fichier trop volumineux après compression: ${(buffer.length / 1024).toFixed(2)} KB`);
        }
  
        const { error } = await supabase.storage
          .from(PHOTOS)
          .upload(filename, buffer, {
            cacheControl: CACHE_CONTROL,
            upsert: true,
            contentType: JPEG,
          });
  
        if (error) throw error;
      }
  
      return this.getImageUrlWithCache(filename);
    } catch (error) {
      console.error("Erreur lors de l'upload:", error);
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
      console.log("Début de la migration de la photo base64...");
      
      // Générer un nom de fichier unique
      const fileName = `photo_${Date.now()}.jpg`;
      console.log("Nom de fichier généré:", fileName);
      
      // Convertir le base64 en Blob
      const response = await fetch(base64Uri);
      const blob = await response.blob();
      console.log("Image base64 convertie en Blob");
      
      // Upload vers Supabase Storage
      const { data, error } = await supabase.storage
        .from(PHOTOS)
        .upload(fileName, blob, {
          contentType: JPEG,
          cacheControl: CACHE_CONTROL
        });
        
      if (error) {
        console.error("Erreur lors de l'upload vers Supabase:", error);
        throw error;
      }
      
      console.log("Photo uploadée avec succès");
      
      return this.getImageUrl(fileName);
    } catch (error) {
      console.error("Erreur lors de la migration de la photo:", error);
      throw error;
    }
  }
}

export const photoService = PhotoService;

