import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { supabase } from '../config/supabase';
import { SUPABASE_CONFIG } from '../config/supabaseConfig';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sentry from '@sentry/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { STORAGE: { BUCKETS: { PHOTOS } } } = SUPABASE_CONFIG;
const SUPABASE_URL = 'https://lixpixyyszvcuwpcgmxe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpeHBpeHl5c3p2Y3V3cGNnbXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODA2NTY4ODQsImV4cCI6MTk5NjIzMjg4NH0.n-wlnGAojzgt2mGTy2wFsS9JWXQwDTjXGHH0TkpGOpI';
const PROJECT_REF = SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1] || '';

// Constantes pour le cache
const IMAGE_CACHE_PREFIX = '@app_image_cache:';
const IMAGE_CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 jours (1 mois)
const MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500 MB
let totalCacheSize = 0;

// Interface pour les informations de cache
interface CacheInfo {
  url: string;
  localUri?: string;
  timestamp: number;
  size?: number;
}

// Vérifie si le Web Cache API est disponible
const isWebCacheAvailable = (): boolean => {
  return Platform.OS === 'web' && typeof caches !== 'undefined';
};

// Vérifie si IndexedDB est disponible (pour le stockage web)
const isIndexedDBAvailable = (): boolean => {
  return Platform.OS === 'web' && typeof indexedDB !== 'undefined';
};

/**
 * Stocke une image dans le cache web (Cache API ou IndexedDB)
 */
const storeInWebCache = async (url: string): Promise<void> => {
  try {
    if (!url) return;

    // Utiliser Cache API si disponible (méthode préférée)
    if (isWebCacheAvailable()) {
      try {
        const cache = await caches.open('image-cache-v1');
        // Utilisez une requête avec mode: 'no-cors' pour éviter les erreurs CORS
        const request = new Request(url, { mode: 'no-cors' });
        const existingResponse = await cache.match(request);
        
        if (!existingResponse) {
          console.log('Stockage de l\'image dans Cache API:', url);
          const response = await fetch(request);
          await cache.put(request, response);
        } else {
          console.log('Image déjà dans Cache API:', url);
        }
      } catch (cacheError) {
        console.error('Erreur avec Cache API:', cacheError);
        // Fallback si Cache API échoue
        useFetchCache(url);
      }
      return;
    }
    
    // Si Cache API n'est pas disponible, utiliser fetch avec cache
    useFetchCache(url);
  } catch (error) {
    console.error('Erreur lors du stockage dans le cache web:', error);
  }
};

// Nouvelle fonction pour utiliser fetch avec cache forcé
const useFetchCache = async (url: string): Promise<void> => {
  try {
    // Ajouter une requête avec des headers qui forcent le cache
    const response = await fetch(url, { 
      method: 'GET',
      cache: 'force-cache',
      headers: {
        'Cache-Control': 'max-age=2592000, stale-while-revalidate=86400' // 30 jours + 1 jour de stale
      } 
    });
    
    if (response.ok) {
      console.log('Image mise en cache par fetch:', url);
    }
  } catch (fetchError) {
    console.error('Erreur fetch cache:', fetchError);
  }
};

/**
 * Initialise et nettoie le cache si nécessaire
 */
const initializeImageCache = async (): Promise<void> => {
  try {
    // Récupérer les infos de cache
    const cacheInfoStr = await AsyncStorage.getItem(`${IMAGE_CACHE_PREFIX}info`);
    
    if (cacheInfoStr) {
      const cacheInfo = JSON.parse(cacheInfoStr);
      totalCacheSize = cacheInfo.totalSize || 0;
      
      // Nettoyer les entrées expirées
      const now = Date.now();
      const keys = await AsyncStorage.getAllKeys();
      const imageCacheKeys = keys.filter(key => 
        key.startsWith(IMAGE_CACHE_PREFIX) && key !== `${IMAGE_CACHE_PREFIX}info`
      );
      
      let sizeReduction = 0;
      
      // Sur les plateformes natives, supprimer aussi les fichiers
      if (Platform.OS !== 'web') {
        for (const key of imageCacheKeys) {
          const cachedItemStr = await AsyncStorage.getItem(key);
          if (cachedItemStr) {
            const cachedItem = JSON.parse(cachedItemStr) as CacheInfo;
            if (now - cachedItem.timestamp > IMAGE_CACHE_DURATION) {
              // Supprimer l'entrée expirée
              if (cachedItem.localUri && cachedItem.size) {
                try {
                  await FileSystem.deleteAsync(cachedItem.localUri, { idempotent: true });
                  sizeReduction += cachedItem.size;
                } catch (e) {
                  console.warn('Erreur lors de la suppression du fichier cache:', e);
                }
              }
              await AsyncStorage.removeItem(key);
            }
          }
        }
      } else {
        // Sur le web, supprimer les entrées expirées AsyncStorage uniquement
        for (const key of imageCacheKeys) {
          const cachedItemStr = await AsyncStorage.getItem(key);
          if (cachedItemStr) {
            const cachedItem = JSON.parse(cachedItemStr) as CacheInfo;
            if (now - cachedItem.timestamp > IMAGE_CACHE_DURATION) {
              await AsyncStorage.removeItem(key);
            }
          }
        }
        
        // Sur le web, nettoyer aussi le Cache API si disponible
        if (isWebCacheAvailable()) {
          try {
            const cache = await caches.open('image-cache-v1');
            const cachedRequests = await cache.keys();
            
            for (const request of cachedRequests) {
              const response = await cache.match(request);
              if (response) {
                const dateHeader = response.headers.get('date');
                if (dateHeader) {
                  const responseDate = new Date(dateHeader).getTime();
                  if (now - responseDate > IMAGE_CACHE_DURATION) {
                    await cache.delete(request);
                  }
                }
              }
            }
          } catch (e) {
            console.warn('Erreur lors du nettoyage du Cache API:', e);
          }
        }
      }
      
      // Mettre à jour la taille totale du cache (pour les plateformes natives)
      if (Platform.OS !== 'web' && sizeReduction > 0) {
        totalCacheSize -= sizeReduction;
        await AsyncStorage.setItem(`${IMAGE_CACHE_PREFIX}info`, JSON.stringify({ 
          totalSize: totalCacheSize,
          lastCleanup: now
        }));
      }
    } else {
      // Initialisation du cache
      await AsyncStorage.setItem(`${IMAGE_CACHE_PREFIX}info`, JSON.stringify({ 
        totalSize: 0,
        lastCleanup: Date.now()
      }));
    }
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du cache:', error);
  }
};

/**
 * Gère la taille du cache et supprime les anciennes entrées si nécessaire
 */
const manageCacheSize = async (additionalSize: number): Promise<void> => {
  try {
    // On ne gère la taille que sur les plateformes natives
    if (Platform.OS === 'web') return;
    
    // Si l'ajout dépasse la limite, nettoyer
    if (totalCacheSize + additionalSize > MAX_CACHE_SIZE) {
      const keys = await AsyncStorage.getAllKeys();
      const imageCacheKeys = keys.filter(key => 
        key.startsWith(IMAGE_CACHE_PREFIX) && key !== `${IMAGE_CACHE_PREFIX}info`
      );
      
      // Trier par horodatage (du plus ancien au plus récent)
      const cacheEntries: {key: string, data: CacheInfo}[] = [];
      for (const key of imageCacheKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          cacheEntries.push({
            key,
            data: JSON.parse(value) as CacheInfo
          });
        }
      }
      
      // Trier par timestamp (plus ancien en premier)
      cacheEntries.sort((a, b) => a.data.timestamp - b.data.timestamp);
      
      // Supprimer les entrées jusqu'à ce que nous ayons suffisamment d'espace
      let spaceNeeded = totalCacheSize + additionalSize - MAX_CACHE_SIZE + 10 * 1024 * 1024; // 10MB supplémentaires pour la marge
      
      for (const entry of cacheEntries) {
        if (spaceNeeded <= 0) break;
        
        if (entry.data.localUri && entry.data.size) {
          try {
            await FileSystem.deleteAsync(entry.data.localUri, { idempotent: true });
            spaceNeeded -= entry.data.size;
            totalCacheSize -= entry.data.size;
          } catch (e) {
            console.warn('Erreur lors de la suppression du fichier cache:', e);
          }
        }
        
        await AsyncStorage.removeItem(entry.key);
      }
      
      // Mettre à jour les infos du cache
      await AsyncStorage.setItem(`${IMAGE_CACHE_PREFIX}info`, JSON.stringify({ 
        totalSize: totalCacheSize,
        lastCleanup: Date.now()
      }));
    }
  } catch (error) {
    console.error('Erreur lors de la gestion du cache:', error);
  }
};

/**
 * Crée un client S3 authentifié avec JWT
 */
export const createAuthenticatedS3Client = async (): Promise<S3Client> => {
  try {
    // Récupérer la session actuelle
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    
    console.log('Création du client S3 avec JWT', { 
      hasToken: !!accessToken,
      projectRef: PROJECT_REF
    });
    
    // Créer le client S3 avec les identifiants appropriés
    return new S3Client({
      region: 'eu-west-3', // Région du projet (peut être n'importe quelle chaîne valide)
      endpoint: `${SUPABASE_URL}/storage/v1/s3`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: PROJECT_REF, // ID du projet
        secretAccessKey: SUPABASE_ANON_KEY, // Clé anonyme
        sessionToken: accessToken, // Token JWT de l'utilisateur
      },
    });
  } catch (error) {
    console.error('Erreur lors de la création du client S3:', error);
    throw error;
  }
};

/**
 * Extrait le nom de fichier d'une URL
 * @param url URL complète
 * @returns Nom du fichier extrait
 */
export const extractFilenameFromUrl = (url: string): string => {
  if (!url) return '';
  
  // Si c'est une URL blob, on ne peut pas l'utiliser directement
  if (url.startsWith('blob:')) {
    return `image_${Date.now()}.jpg`;
  }
  
  // Extraire le nom du fichier de l'URL
  const parts = url.split('/');
  const filenameWithParams = parts[parts.length - 1];
  
  // Supprimer les paramètres d'URL si présents
  const filename = filenameWithParams.split('?')[0];
  
  return filename;
};

/**
 * Télécharge une image en utilisant l'authentification Supabase
 * @param path Chemin de l'image
 * @returns URL signée pour accéder à l'image
 */
export const downloadImageWithS3Auth = async (path: string): Promise<string | null> => {
  try {
    // Initialiser le cache au besoin
    await initializeImageCache();
    
    // Générer une clé de cache à partir du chemin
    const cacheKey = `${IMAGE_CACHE_PREFIX}${path}`;
    
    // Vérifier si nous avons cette image en cache dans AsyncStorage
    const cachedItemStr = await AsyncStorage.getItem(cacheKey);
    if (cachedItemStr) {
      const cachedItem = JSON.parse(cachedItemStr) as CacheInfo;
      
      // Vérifier si le cache est encore valide
      if (Date.now() - cachedItem.timestamp < IMAGE_CACHE_DURATION) {
        if (Platform.OS !== 'web' && cachedItem.localUri) {
          // Sur mobile, vérifier si le fichier local existe
          const fileInfo = await FileSystem.getInfoAsync(cachedItem.localUri);
          if (fileInfo.exists) {
            console.log('Utilisation fichier local en cache pour:', path);
            return cachedItem.localUri;
          }
        } else if (cachedItem.url) {
          // Sur web ou si pas de fichier local
          console.log('Utilisation URL en cache pour:', path);
          
          if (Platform.OS === 'web') {
            try {
              // Sur le web, vérifier si l'image est dans le Cache API
              if (isWebCacheAvailable()) {
                const cache = await caches.open('image-cache-v1');
                // Utiliser mode: 'no-cors' pour la requête de vérification
                const request = new Request(cachedItem.url, { mode: 'no-cors' });
                const cachedResponse = await cache.match(request);
                
                if (cachedResponse) {
                  console.log('Image trouvée dans Cache API:', path);
                  // L'image est déjà dans le cache du navigateur
                } else {
                  console.log('Image pas dans Cache API, stockage:', path);
                  // Stocker l'image dans le cache
                  await storeInWebCache(cachedItem.url);
                }
              } else {
                // Si Cache API n'est pas disponible, essayer de forcer le cache via fetch
                await useFetchCache(cachedItem.url);
              }
              
              // Pour les images en cache, ajouter un timestamp pour éviter la mise en cache du navigateur
              // Cela assurera que l'image est bien chargée depuis notre cache et non du cache HTTP
              return `${cachedItem.url}${cachedItem.url.includes('?') ? '&' : '?'}_cache_bust=${Date.now()}`;
            } catch (error) {
              console.error('Erreur lors de la vérification du cache web:', error);
            }
            
            // Même en cas d'erreur, renvoyer l'URL en cache
            return cachedItem.url;
          } else {
            return cachedItem.url;
          }
        }
      }
    }
    
    // Si c'est une URL blob, on ne peut pas l'utiliser avec l'API Supabase
    if (path.startsWith('blob:')) {
      
      // Pour les URLs blob sur le web, on peut essayer de récupérer l'URL publique
      if (Platform.OS === 'web') {
        try {
          // Générer un nom de fichier temporaire
          const tempFilename = `temp_${Date.now()}.jpg`;
          
          // Récupérer l'URL publique (qui ne fonctionnera pas, mais c'est pour éviter l'erreur)
          const { data } = supabase.storage
            .from(PHOTOS)
            .getPublicUrl(tempFilename);
            
          console.log('Tentative de récupération de l\'URL publique...');
          
          if (data?.publicUrl) {
            // Remplacer le nom de fichier temporaire par l'URL blob dans l'URL publique
            // Cela ne fonctionnera pas pour le téléchargement, mais permettra d'éviter l'erreur 400
            const publicUrl = data.publicUrl.replace(tempFilename, extractFilenameFromUrl(path));
            console.log('URL publique récupérée:', publicUrl);
            
            // Mettre en cache cette URL
            await AsyncStorage.setItem(cacheKey, JSON.stringify({
              url: publicUrl,
              timestamp: Date.now()
            }));
            
            // Sur web, stocker aussi dans le cache API
            if (Platform.OS === 'web') {
              storeInWebCache(publicUrl);
            }
            
            return publicUrl;
          }
        } catch (error) {
          console.error('Erreur lors de la récupération de l\'URL publique:', error);
        }
      }
      
      return null;
    }
    
    // Normaliser le chemin pour Supabase
    let normalizedPath = path;
    
    // Si le chemin est une URL complète, extraire le nom du fichier
    if (path.startsWith('http')) {
      normalizedPath = extractFilenameFromUrl(path);
    }
    
    // Si le chemin contient déjà le bucket, extraire le chemin relatif
    if (path.includes(`/${PHOTOS}/`)) {
      normalizedPath = path.substring(path.indexOf(`${PHOTOS}/`) + PHOTOS.length + 1);
    }    
    // Créer une URL signée pour accéder à l'image
    const { data, error } = await supabase.storage
      .from(PHOTOS)
      .createSignedUrl(normalizedPath, 60 * 60 * 24 * 30); // 30 jours de validité
    
    if (error) {
      console.error('Erreur lors de la création de l\'URL signée:', error);
      
      // En cas d'erreur, essayer de récupérer l'URL publique
      try {
        console.log('Tentative de récupération de l\'URL publique...');
        const { data } = supabase.storage
          .from(PHOTOS)
          .getPublicUrl(normalizedPath);
          
        if (data?.publicUrl) {
          console.log('URL publique récupérée:', data.publicUrl);
          
          // Mettre en cache l'URL publique et définir un long cache avec des headers spécifiques
          await AsyncStorage.setItem(cacheKey, JSON.stringify({
            url: data.publicUrl,
            timestamp: Date.now()
          }));
          
          // Sur web, stocker aussi dans le cache API
          if (Platform.OS === 'web') {
            await storeInWebCache(data.publicUrl);
          }
          
          return data.publicUrl;
        }
      } catch (publicUrlError) {
        console.error('Erreur lors de la récupération de l\'URL publique:', publicUrlError);
      }
      
      throw error;
    }
    
    if (!data?.signedUrl) {
      console.error('Aucune URL signée retournée');
      return null;
    }
    
    const signedUrl = data.signedUrl;
    
    // Mettre en cache l'URL dans AsyncStorage
    if (Platform.OS === 'web') {
      // Sur le web, on stocke juste l'URL dans AsyncStorage
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        url: signedUrl,
        timestamp: Date.now()
      }));
      
      // Stocker l'image dans le cache du navigateur immédiatement
      await storeInWebCache(signedUrl);
      
      return signedUrl;
    } else {
      // Sur mobile, télécharger l'image localement pour un accès plus rapide
      try {
        // Créer un nom de fichier local unique
        const localFilename = FileSystem.documentDirectory + 
          'image_cache/' + 
          normalizedPath.replace(/\//g, '_');
        
        // S'assurer que le répertoire existe
        const dirPath = localFilename.substring(0, localFilename.lastIndexOf('/'));
        const dirInfo = await FileSystem.getInfoAsync(dirPath);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
        }
        
        // Télécharger l'image
        const downloadResult = await FileSystem.downloadAsync(
          signedUrl,
          localFilename
        );
        
        if (downloadResult.status === 200) {
          // Obtenir les infos sur le fichier téléchargé
          const fileInfo = await FileSystem.getInfoAsync(localFilename);
          
          if (fileInfo.exists) {
            // Gérer la taille du cache
            await manageCacheSize(fileInfo.size || 0);
            
            // Ajouter au cache
            totalCacheSize += fileInfo.size || 0;
            await AsyncStorage.setItem(cacheKey, JSON.stringify({
              url: signedUrl,
              localUri: localFilename,
              timestamp: Date.now(),
              size: fileInfo.size
            }));
            
            // Mettre à jour les infos du cache
            await AsyncStorage.setItem(`${IMAGE_CACHE_PREFIX}info`, JSON.stringify({
              totalSize: totalCacheSize,
              lastCleanup: Date.now()
            }));
            
            return localFilename;
          }
        }
        
        // En cas d'échec du téléchargement, utiliser l'URL directement
        await AsyncStorage.setItem(cacheKey, JSON.stringify({
          url: signedUrl,
          timestamp: Date.now()
        }));
      } catch (downloadError) {
        console.error('Erreur lors du téléchargement de l\'image:', downloadError);
        
        // En cas d'erreur, on met en cache uniquement l'URL
        await AsyncStorage.setItem(cacheKey, JSON.stringify({
          url: signedUrl,
          timestamp: Date.now()
        }));
      }
      
      return signedUrl;
    }
  } catch (error) {
    console.error('Erreur lors du téléchargement avec authentification:', error);
    Sentry.captureException(error, {
      tags: { context: 'download_image_s3_auth' },
      extra: { path }
    });
    return null;
  }
};

/**
 * Efface le cache d'images
 */
export const clearImageCache = async (): Promise<void> => {
  try {
    // Récupérer toutes les clés de cache
    const keys = await AsyncStorage.getAllKeys();
    const imageCacheKeys = keys.filter(key => key.startsWith(IMAGE_CACHE_PREFIX));
    
    if (Platform.OS === 'web') {
      // Sur le web, effacer AsyncStorage et également le Cache API
      await AsyncStorage.multiRemove(imageCacheKeys);
      
      // Nettoyer le Cache API si disponible
      if (isWebCacheAvailable()) {
        try {
          const cache = await caches.open('image-cache-v1');
          const cachedRequests = await cache.keys();
          
          for (const request of cachedRequests) {
            await cache.delete(request);
          }
          
          console.log('Cache API nettoyé avec succès');
        } catch (e) {
          console.warn('Erreur lors du nettoyage du Cache API:', e);
        }
      }
    } else {
      // Sur mobile, on doit aussi supprimer les fichiers
      for (const key of imageCacheKeys) {
        if (key === `${IMAGE_CACHE_PREFIX}info`) continue;
        
        const value = await AsyncStorage.getItem(key);
        if (value) {
          const cacheInfo = JSON.parse(value) as CacheInfo;
          if (cacheInfo.localUri) {
            try {
              await FileSystem.deleteAsync(cacheInfo.localUri, { idempotent: true });
            } catch (e) {
              console.warn('Erreur lors de la suppression du fichier cache:', e);
            }
          }
        }
      }
      
      await AsyncStorage.multiRemove(imageCacheKeys);
      
      // Réinitialiser les infos du cache
      await AsyncStorage.setItem(`${IMAGE_CACHE_PREFIX}info`, JSON.stringify({
        totalSize: 0,
        lastCleanup: Date.now()
      }));
      
      totalCacheSize = 0;
    }
    
    console.log('Cache d\'images effacé avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'effacement du cache d\'images:', error);
  }
}; 