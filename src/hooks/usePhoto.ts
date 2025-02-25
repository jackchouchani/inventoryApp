import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Sentry from '@sentry/react-native';
import { supabase } from '../config/supabase';
import { SUPABASE_CONFIG } from '../config/supabaseConfig';
import { MAX_PHOTO_SIZE, ALLOWED_PHOTO_TYPES, PHOTO_COMPRESSION_OPTIONS } from '../constants/photos';
import { downloadImageWithS3Auth, extractFilenameFromUrl } from '../utils/s3AuthClient';

const { STORAGE: { BUCKETS: { PHOTOS } } } = SUPABASE_CONFIG;
const S3_URL = SUPABASE_CONFIG.S3_URL;

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

  // Normalise les chemins d'images pour supporter différents formats
  const normalizePath = useCallback((path: string): { isFullUrl: boolean; normalizedPath: string; filename: string; isSignedUrl: boolean } => {
    // Si le chemin est vide
    if (!path) {
      return { isFullUrl: false, normalizedPath: '', filename: '', isSignedUrl: false };
    }

    // Si c'est déjà une URL complète
    const isFullUrl = path.startsWith('http://') || path.startsWith('https://');
    
    // Vérifie si c'est une URL signée
    const isSignedUrl = path.includes('/object/sign/') && path.includes('?token=');
    
    // Si le chemin contient déjà le bucket et le préfixe supabase
    const containsSupabasePath = path.includes(`/${PHOTOS}/`) || path.includes(`${S3_URL}`);
    
    let normalizedPath = path;
    let filename = '';
    
    if (isFullUrl) {
      // C'est une URL complète
      if (isSignedUrl) {
        // Extrait le nom du fichier d'une URL signée (tout ce qui est entre le dernier / et le ?)
        const filenameMatch = path.match(/\/([^\/]+)\?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
          // Pour les URLs signées, on garde juste le nom du fichier comme chemin
          normalizedPath = filename;
        }
      } else if (path.includes(`${S3_URL}/${PHOTOS}/`)) {
        // Extrait le chemin relatif de l'URL complète
        normalizedPath = path.substring(path.indexOf(`${PHOTOS}/`) + PHOTOS.length + 1);
        filename = path.split('/').pop() || '';
      } else {
        // URL complète mais pas dans notre bucket
        filename = path.split('/').pop() || '';
      }
    } else {
      // Si c'est un chemin relatif sans préfixe de bucket, ajouter le préfixe
      if (!containsSupabasePath) {
        normalizedPath = path;
      } else if (path.startsWith(`${PHOTOS}/`)) {
        normalizedPath = path.substring(PHOTOS.length + 1);
      }
      
      filename = path.replace(/\//g, '_');
    }
        
    return { isFullUrl, normalizedPath, filename, isSignedUrl };
  }, []);

  // Fonction pour valider une photo
  const validatePhoto = useCallback(async (uri: string): Promise<boolean> => {
    try {
      console.log(`[usePhoto] validatePhoto - Début validation: ${uri.substring(0, 50)}...`);
      
      // Vérifier si c'est une URI base64
      const isBase64 = uri.startsWith('data:image/');
      
      // Vérifier si c'est une URL blob (spécifique au web)
      const isBlobUrl = uri.startsWith('blob:');
      
      if (isBlobUrl) {
        console.log(`[usePhoto] validatePhoto - Détection d'une URL blob`);
        
        if (Platform.OS === 'web') {
          try {
            // Pour les URLs blob, on doit récupérer le contenu pour vérifier le type et la taille
            const response = await fetch(uri);
            if (!response.ok) {
              console.error(`[usePhoto] validatePhoto - Échec de récupération de l'URL blob: ${response.status}`);
              throw new Error(`Échec de récupération de l'URL blob: ${response.status}`);
            }
            
            const blob = await response.blob();
            console.log(`[usePhoto] validatePhoto - Blob récupéré, type: ${blob.type}, taille: ${blob.size}`);
            
            // Vérifier le type MIME
            if (!ALLOWED_PHOTO_TYPES.includes(blob.type)) {
              console.error(`[usePhoto] validatePhoto - Type de fichier blob non supporté: ${blob.type}`);
              throw new Error('Format de photo non supporté');
            }
            
            // Vérifier la taille
            if (blob.size > MAX_PHOTO_SIZE) {
              console.error(`[usePhoto] validatePhoto - Blob trop volumineux: ${blob.size/1024/1024}MB (max ${MAX_PHOTO_SIZE/1024/1024}MB)`);
              throw new Error(`La photo est trop volumineuse (max ${MAX_PHOTO_SIZE / 1024 / 1024}MB)`);
            }
            
            return true;
          } catch (error: unknown) {
            console.error(`[usePhoto] validatePhoto - Erreur lors de la validation du blob:`, error);
            throw error instanceof Error ? error : new Error('Erreur lors de la validation du blob');
          }
        } else {
          console.error(`[usePhoto] validatePhoto - Les URLs blob ne sont pas supportées sur cette plateforme`);
          throw new Error('Les URLs blob ne sont pas supportées sur cette plateforme');
        }
      }
      
      if (isBase64) {
        console.log(`[usePhoto] validatePhoto - Détection d'une image base64`);
        
        // Pour les images base64, extraire le type MIME et vérifier qu'il est autorisé
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
        
        // Vérification approximative de la taille pour base64
        // 4 caractères base64 = 3 octets, donc on divise par 4 et multiplie par 3
        // On retire aussi l'en-tête avant la partie base64
        const base64Data = uri.split(',')[1];
        const approximateSize = (base64Data.length * 3) / 4;
        
        if (approximateSize > MAX_PHOTO_SIZE) {
          console.error(`[usePhoto] validatePhoto - Image trop volumineuse: ~${Math.round(approximateSize/1024/1024)}MB (max ${MAX_PHOTO_SIZE/1024/1024}MB)`);
          throw new Error(`La photo est trop volumineuse (max ${MAX_PHOTO_SIZE / 1024 / 1024}MB)`);
        }
        
        return true;
      } 
      
      // Logique existante pour les fichiers non-base64
      const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
      if (!fileInfo.exists || fileInfo.size === undefined) {
        console.error(`[usePhoto] validatePhoto - Le fichier n'existe pas: ${uri}`);
        throw new Error('Le fichier n\'existe pas');
      }

      if (fileInfo.size > MAX_PHOTO_SIZE) {
        console.error(`[usePhoto] validatePhoto - Fichier trop volumineux: ${fileInfo.size/1024/1024}MB (max ${MAX_PHOTO_SIZE/1024/1024}MB)`);
        throw new Error(`La photo est trop volumineuse (max ${MAX_PHOTO_SIZE / 1024 / 1024}MB)`);
      }

      const extension = uri.split('.').pop()?.toLowerCase() || '';
      const mimeType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;

      if (!ALLOWED_PHOTO_TYPES.includes(mimeType)) {
        console.error(`[usePhoto] validatePhoto - Extension non supportée: ${extension}, MIME type: ${mimeType}`);
        throw new Error('Format de photo non supporté');
      }

      return true;
    } catch (error) {
      console.error(`[usePhoto] validatePhoto - Échec:`, error);
      Sentry.captureException(error, {
        tags: { context: 'photo_validation' },
        extra: { uri: uri.substring(0, 100) + '...' }
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

  // Fonction pour charger une image avec cache et authentification Supabase
  const loadImage = useCallback(async (path: string, cacheKey?: string) => {
    console.log(`[usePhoto] loadImage - Début pour path: ${path}, cacheKey: ${cacheKey}`);
    
    // Si le chemin est vide, ne rien faire
    if (!path) {
      console.log(`[usePhoto] loadImage - Chemin vide, aucune action nécessaire`);
      return null;
    }
    
    // Vérifier si c'est une URL blob ou une URI data (base64)
    const isBlobUrl = path.startsWith('blob:');
    const isDataUri = path.startsWith('data:');
    
    // Pour les URLs blob ou data URIs, on les utilise directement sans essayer de les télécharger
    if (isBlobUrl || isDataUri) {
      console.log(`[usePhoto] loadImage - Détection d'une ${isBlobUrl ? 'URL blob' : 'URI data'}, utilisation directe sans téléchargement`);
      setState({ uri: path, loading: false, error: null });
      return path;
    }
    
    // Normaliser le chemin pour déterminer comment le traiter
    const { normalizedPath, isFullUrl, isSignedUrl, filename } = normalizePath(path);
    console.log(`[usePhoto] loadImage - Après normalisation: ${JSON.stringify({ normalizedPath, isFullUrl, isSignedUrl, filename })}`);
    
    // Vérifier le cache en mémoire pour le web
    if (Platform.OS === 'web' && cacheKey && memoryCache[cacheKey]) {
      console.log(`[usePhoto] loadImage - Image trouvée dans le cache mémoire pour la clé: ${cacheKey}`);
      setState({ uri: memoryCache[cacheKey], loading: false, error: null });
      return memoryCache[cacheKey];
    }
    
    // Mettre à jour l'état pour indiquer le chargement
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Essayer de télécharger l'image avec l'authentification S3
      console.log(`[usePhoto] loadImage - Tentative avec downloadImageWithS3Auth: ${filename}`);
      const signedUrl = await downloadImageWithS3Auth(normalizedPath);
      
      if (signedUrl) {
        console.log(`[usePhoto] loadImage - URL signée récupérée (${Platform.OS}): ${signedUrl}`);
        
        // Mettre en cache pour le web
        if (Platform.OS === 'web' && cacheKey) {
          memoryCache[cacheKey] = signedUrl;
        }
        
        setState({ uri: signedUrl, loading: false, error: null });
        return signedUrl;
      }
      
      // Si pas d'URL signée mais que c'est une URL complète, l'utiliser directement
      if (isFullUrl) {
        console.log(`[usePhoto] loadImage - Utilisation directe de l'URL complète: ${path}`);
        setState({ uri: path, loading: false, error: null });
        return path;
      }
      
      // Sinon, essayer de récupérer l'URL publique
      console.log(`[usePhoto] loadImage - Tentative avec getPublicUrl: ${normalizedPath}`);
      const publicUrl = await getPublicUrlInternal(normalizedPath);
      
      if (publicUrl) {
        console.log(`[usePhoto] loadImage - URL publique récupérée: ${publicUrl}`);
        
        // Mettre en cache pour le web
        if (Platform.OS === 'web' && cacheKey) {
          memoryCache[cacheKey] = publicUrl;
        }
        
        setState({ uri: publicUrl, loading: false, error: null });
        return publicUrl;
      }
      
      // Si toutes les tentatives échouent, utiliser l'URI d'origine
      console.log(`[usePhoto] loadImage - Aucune URL récupérée, utilisation de l'URI d'origine: ${path}`);
      setState({ uri: path, loading: false, error: null });
      return path;
    } catch (error) {
      console.error(`[usePhoto] loadImage - Erreur:`, error);
      setState(prev => ({ ...prev, loading: false, error: error instanceof Error ? error : new Error('Erreur de chargement') }));
      throw error;
    }
  }, [normalizePath, downloadImageWithS3Auth]);

  // Fonction pour uploader une photo vers Supabase
  const uploadPhoto = useCallback(async (uri: string, shouldCompress = true, customFilename?: string): Promise<string | null> => {
    try {
      console.log(`[usePhoto] uploadPhoto - Début pour URI: ${uri.substring(0, 50)}...`);
      
      // Valider la photo
      const isValid = await validatePhoto(uri);
      if (!isValid) {
        console.error(`[usePhoto] uploadPhoto - Photo invalide`);
        throw new Error('Photo invalide');
      }
      
      let processedUri = uri;
      
      // Pour les plateformes natives uniquement, compresser si demandé
      if (shouldCompress && Platform.OS !== 'web') {
        console.log(`[usePhoto] uploadPhoto - Compression de l'image avant upload (plateformes natives uniquement)`);
        processedUri = await compressImage(uri);
      }
      
      // Générer un nom de fichier unique
      const timestamp = Date.now();
      const filename = customFilename || `photo_${timestamp}.jpg`;
      
      console.log(`[usePhoto] uploadPhoto - Préparation de l'upload vers ${PHOTOS}/${filename}`);
      
      // Pour le web, traitement spécial pour les URIs base64 et les URLs blob
      if (Platform.OS === 'web') {
        console.log(`[usePhoto] uploadPhoto - Mode d'upload web détecté`);
        
        // Vérifier si c'est une URI base64
        if (processedUri.startsWith('data:')) {
          console.log(`[usePhoto] uploadPhoto - Upload base64 sur le web`);
          
          // Extraire le type MIME et les données base64
          const matches = processedUri.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
          if (!matches) {
            throw new Error('Format de données base64 invalide');
          }
          
          const mimeType = matches[1];
          const base64Data = matches[2];
          
          // Convertir les données base64 en ArrayBuffer pour l'upload
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          // Upload avec ArrayBuffer
          const { data, error } = await supabase
            .storage
            .from(PHOTOS)
            .upload(filename, bytes.buffer, {
              contentType: mimeType,
              upsert: true
            });
          
          if (error) {
            console.error(`[usePhoto] uploadPhoto - Erreur Supabase:`, error);
            throw error;
          }
          
          if (!data) {
            throw new Error('Aucune donnée retournée par Supabase');
          }
          
          // Obtenir l'URL publique
          const { data: publicUrlData } = supabase
            .storage
            .from(PHOTOS)
            .getPublicUrl(data.path);
          
          console.log(`[usePhoto] uploadPhoto - Upload réussi, URL publique:`, publicUrlData?.publicUrl);
          return publicUrlData?.publicUrl || null;
        }
        
        // Pour les URLs blob sur le web
        else if (processedUri.startsWith('blob:')) {
          console.log(`[usePhoto] uploadPhoto - Upload blob URL sur le web`);
          
          // Récupérer le blob
          const response = await fetch(processedUri);
          const blob = await response.blob();
          
          // Upload avec blob
          const { data, error } = await supabase
            .storage
            .from(PHOTOS)
            .upload(filename, blob, {
              contentType: blob.type,
              upsert: true
            });
          
          if (error) {
            console.error(`[usePhoto] uploadPhoto - Erreur Supabase:`, error);
            throw error;
          }
          
          if (!data) {
            throw new Error('Aucune donnée retournée par Supabase');
          }
          
          // Obtenir l'URL publique
          const { data: publicUrlData } = supabase
            .storage
            .from(PHOTOS)
            .getPublicUrl(data.path);
          
          console.log(`[usePhoto] uploadPhoto - Upload réussi, URL publique:`, publicUrlData?.publicUrl);
          return publicUrlData?.publicUrl || null;
        }
      }
      
      // Pour les plateformes natives ou les autres types d'URI sur le web
      const formData = new FormData();
      
      // Préparer le fichier selon la plateforme
      if (Platform.OS === 'web') {
        // Sur le web, créer un objet file à partir de l'URI
        const response = await fetch(processedUri);
        const blob = await response.blob();
        const file = new File([blob], filename, { type: blob.type });
        formData.append('file', file);
      } else {
        // Sur mobile, ajouter l'URI directement
        formData.append('file', {
          uri: processedUri,
          name: filename,
          type: 'image/jpeg'
        } as any);
      }
      
      console.log(`[usePhoto] uploadPhoto - Début upload vers Supabase, bucket: ${PHOTOS}`);
      const { data, error: uploadError } = await supabase.storage
        .from(PHOTOS)
        .upload(filename, formData, {
          contentType: 'image/jpeg',
          cacheControl: '3600'
        });

      if (uploadError) {
        console.error(`[usePhoto] uploadPhoto - Erreur d'upload Supabase:`, uploadError);
        setState(prev => ({ ...prev, loading: false, error: uploadError }));
        throw uploadError;
      }
      console.log(`[usePhoto] uploadPhoto - Upload réussi, data:`, data);

      // Si besoin de l'URL publique
      if (data) {
        console.log(`[usePhoto] uploadPhoto - Génération de l'URL publique`);
        const { data: publicUrlData } = supabase.storage
          .from(PHOTOS)
          .getPublicUrl(data.path);

        const publicUrl = publicUrlData?.publicUrl;
        if (!publicUrl) {
          console.error(`[usePhoto] uploadPhoto - Échec de génération d'URL publique`);
          setState(prev => ({ ...prev, loading: false, error: new Error('Échec de la génération d\'URL publique') }));
          throw new Error('Échec de la génération de l\'URL publique');
        }
        
        console.log(`[usePhoto] uploadPhoto - URL publique générée:`, publicUrl);
        setState({ uri: processedUri, loading: false, error: null });
        return publicUrl;
      }

      // Sinon retourner juste le nom du fichier
      console.log(`[usePhoto] uploadPhoto - Retour du nom de fichier:`, filename);
      setState({ uri: processedUri, loading: false, error: null });
      return filename;
    } catch (error) {
      console.error(`[usePhoto] uploadPhoto - Erreur fatale:`, error);
      const finalError = error instanceof Error ? error : new Error('Échec de l\'upload');
      setState(prev => ({ ...prev, loading: false, error: finalError }));
      throw finalError;
    }
  }, [validatePhoto, compressImage, normalizePath]);

  // Fonction pour supprimer une photo
  const deletePhoto = useCallback(async (path: string): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Normaliser le chemin pour obtenir juste le nom de fichier
      const { normalizedPath, filename, isSignedUrl } = normalizePath(path);
      
      // Déterminer le nom de fichier à supprimer
      let fileToDelete = '';
      
      if (isSignedUrl) {
        fileToDelete = filename;
      } else if (path.includes('/')) {
        fileToDelete = path.split('/').pop() || '';
      } else {
        fileToDelete = path;
      }
      
      if (!fileToDelete) {
        throw new Error('URL de photo invalide');
      }
      
      console.log(`Suppression du fichier: ${fileToDelete}`);

      const { error } = await supabase.storage
        .from(PHOTOS)
        .remove([fileToDelete]);

      if (error) {
        console.error('Erreur lors de la suppression:', error);
        throw error;
      }

      setState(prev => ({ ...prev, loading: false, error: null }));
    } catch (error) {
      const finalError = error instanceof Error ? error : new Error('Échec de la suppression');
      setState(prev => ({ ...prev, loading: false, error: finalError }));
      throw finalError;
    }
  }, [normalizePath]);

  // Fonction pour récupérer l'URL publique d'une image
  const getPublicUrlInternal = useCallback(async (path: string): Promise<string | null> => {
    try {
      console.log(`[usePhoto] getPublicUrl - Début pour: ${path}`);
      
      // Normaliser le chemin
      let normalizedPath = path;
      
      // Si le chemin est une URL complète, extraire le nom du fichier
      if (path.startsWith('http')) {
        normalizedPath = extractFilenameFromUrl(path);
      }
      
      // Si le chemin contient déjà le bucket, extraire le chemin relatif
      if (path.includes(`/${PHOTOS}/`)) {
        normalizedPath = path.substring(path.indexOf(`${PHOTOS}/`) + PHOTOS.length + 1);
      }      
      const { data } = supabase.storage
        .from(PHOTOS)
        .getPublicUrl(normalizedPath);
        
      if (!data?.publicUrl) {
        console.error(`[usePhoto] getPublicUrl - Échec de récupération de l'URL publique`);
        return null;
      }
      
      console.log(`[usePhoto] getPublicUrl - URL publique récupérée: ${data.publicUrl}`);
      return data.publicUrl;
    } catch (error) {
      console.error(`[usePhoto] getPublicUrl - Erreur:`, error);
      return null;
    }
  }, []);

  // Fonction publique pour récupérer l'URL publique (pour l'API externe)
  const getPublicUrl = useCallback(async (path: string): Promise<string | null> => {
    return getPublicUrlInternal(path);
  }, [getPublicUrlInternal]);

  return {
    ...state,
    loadImage,
    uploadPhoto,
    deletePhoto,
    validatePhoto,
    getPublicUrl
  };
}; 