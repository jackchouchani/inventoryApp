import { useState, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Sentry from '@sentry/react-native';
import { supabase } from '../config/supabase';
import { SUPABASE_CONFIG } from '../config/supabaseConfig';
import { MAX_PHOTO_SIZE, ALLOWED_PHOTO_TYPES, PHOTO_COMPRESSION_OPTIONS } from '../constants/photos';
import { downloadImageWithS3Auth, extractFilenameFromUrl } from '../utils/s3AuthClient';
import { decode } from 'base64-arraybuffer';
import { compressImage as compressImageUtil } from '../utils/imageCompression';

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

  // Fonction pour compresser une image avec compression progressive
  const compressImage = useCallback(async (uri: string): Promise<string> => {
    console.log(`[usePhoto] compressImage - Début de compression: ${uri.substring(0, 50)}...`);
    try {
      // Utiliser notre fonction utilitaire de compression
      return await compressImageUtil(uri);
    } catch (error) {
      console.error(`[usePhoto] Erreur lors de la compression:`, error);
      throw error;
    }
  }, []);

  // Fonction pour charger une image avec cache et authentification Supabase
  const loadImage = useCallback(async (path: string): Promise<string | null> => {
    try {
    if (!path) {
        console.log(`[usePhoto] loadImage - Chemin vide, impossible de charger l'image`);
      return null;
    }
    
      setState({ uri: null, loading: true, error: null });
      console.log(`[usePhoto] loadImage - Début chargement: ${path.substring(0, 50)}...`);

      // Normaliser le chemin pour les URLs signées
      const pathInfo = normalizePath(path);
      
      // Essayer d'abord avec download
      if (pathInfo.normalizedPath) {
        console.log(`[usePhoto] loadImage - Tentative avec chemin normalisé: ${pathInfo.normalizedPath}`);
        
        try {
          const localUri = await downloadImageWithS3Auth(pathInfo.normalizedPath);
          if (localUri) {
            console.log(`[usePhoto] loadImage - Image téléchargée: ${localUri.substring(0, 50)}...`);
            setState({ uri: localUri, loading: false, error: null });
            return localUri;
          }
        } catch (downloadError) {
          console.log(`[usePhoto] loadImage - Échec du téléchargement: ${downloadError}`);
          // Continuer avec la tentative suivante
        }
      }
      
      // Sinon, essayer de récupérer l'URL publique
      console.log(`[usePhoto] loadImage - Tentative avec getPublicUrl: ${pathInfo.normalizedPath}`);
      
      // Utiliser la fonction importée de imageUtils
      const { getPublicImageUrl } = require('../utils/imageUtils');
      const publicUrl = await getPublicImageUrl(pathInfo.normalizedPath);
      
      if (publicUrl) {
        console.log(`[usePhoto] loadImage - URL publique récupérée: ${publicUrl}`);
        setState({ uri: publicUrl, loading: false, error: null });
        return publicUrl;
      }
      
      // Si toutes les tentatives échouent
      console.error(`[usePhoto] loadImage - Échec de récupération de l'image: ${path}`);
      setState({ uri: null, loading: false, error: new Error(`Impossible de charger l'image: ${path}`) });
      return null;
    } catch (error) {
      console.error(`[usePhoto] loadImage - Erreur:`, error);
      setState({ uri: null, loading: false, error: error as Error });
      return null;
    }
  }, [normalizePath, downloadImageWithS3Auth]);

  // Fonction pour supprimer une photo de Supabase Storage
  const deletePhoto = useCallback(async (url: string): Promise<void> => {
    try {
      setState({ uri: null, loading: true, error: null });
      console.log(`[usePhoto] deletePhoto - Début de la suppression pour: ${url.substring(0, 50)}...`);
      
      if (!url) {
        console.warn(`[usePhoto] deletePhoto - URL vide, rien à supprimer`);
        setState({ uri: null, loading: false, error: null });
        return;
      }
      
      // Extraire le nom du fichier de l'URL
      const filename = extractFilenameFromUrl(url);
      
      if (!filename) {
        console.error(`[usePhoto] deletePhoto - Impossible d'extraire le nom de fichier de l'URL: ${url}`);
        throw new Error(`Impossible d'extraire le nom de fichier`);
      }
      
      console.log(`[usePhoto] deletePhoto - Suppression du fichier: ${filename}`);
      
      // Supprimer le fichier via Supabase
      const { error } = await supabase.storage
        .from(PHOTOS)
        .remove([filename]);
        
      if (error) {
        console.error(`[usePhoto] deletePhoto - Erreur lors de la suppression:`, error);
        setState({ uri: null, loading: false, error });
        throw error;
      }
      
      console.log(`[usePhoto] deletePhoto - Suppression réussie pour: ${filename}`);
      setState({ uri: null, loading: false, error: null });
    } catch (error) {
      console.error(`[usePhoto] deletePhoto - Erreur:`, error);
      setState({ 
        uri: null, 
        loading: false, 
        error: error instanceof Error ? error : new Error(String(error))
      });
      throw error;
    }
  }, []);

  // Fonction pour uploader une photo vers Supabase
  const uploadPhoto = useCallback(async (uri: string, shouldCompress = true, customFilename?: string): Promise<string | null> => {
    try {
      setState({ uri: null, loading: true, error: null });
      console.log(`[usePhoto] uploadPhoto - Début pour URI: ${uri.substring(0, 50)}...`);
      
      // Détection de Safari iOS pour traitement spécifique
      const isSafariIOS = Platform.OS === 'web' && 
        typeof navigator !== 'undefined' && 
        (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (/^((?!chrome|android).)*safari/i.test(navigator.userAgent) && /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent)));
      
      if (isSafariIOS) {
        console.log(`[usePhoto] Détection de Safari iOS, traitement spécifique`);
      }
      
      // Toujours compresser d'abord pour éviter les rejets inutiles
      let processedUri = uri;
      if (shouldCompress) {
        console.log(`[usePhoto] uploadPhoto - Compression préalable de l'image`);
        try {
          processedUri = await compressImage(uri);
          console.log(`[usePhoto] Compression terminée`);
          
          // Vérifier si la compression a fonctionné
          if (processedUri === uri && isSafariIOS) {
            console.warn(`[usePhoto] La compression n'a pas changé l'URI sur Safari iOS, réessai avec Canvas`);
            // Sur Safari iOS, si la compression n'a pas fonctionné, essayer une autre approche
            if (uri.startsWith('data:')) {
              try {
                // Créer une image et un canvas pour forcer une conversion
                const img = new Image();
                await new Promise<void>((resolve, reject) => {
                  img.onload = () => resolve();
                  img.onerror = (e) => reject(new Error('Échec de chargement de l\'image'));
                  img.src = uri;
                });
                
                const canvas = document.createElement('canvas');
                const maxDim = 1200;
                const ratio = Math.min(maxDim / img.width, maxDim / img.height);
                canvas.width = img.width * ratio;
                canvas.height = img.height * ratio;
                
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  processedUri = canvas.toDataURL('image/jpeg', 0.8);
                  console.log(`[usePhoto] Conversion forcée via Canvas réussie`);
                }
              } catch (canvasError) {
                console.error(`[usePhoto] Échec de la conversion forcée:`, canvasError);
              }
            }
          }
        } catch (compressError) {
          console.error(`[usePhoto] Erreur de compression, utilisation de l'original:`, compressError);
          // Continuer avec l'URI d'origine
        }
      }
      
      // Générer un nom de fichier unique
      const timestamp = Date.now();
      const filename = customFilename || `photo_${timestamp}.jpg`;
      
      console.log(`[usePhoto] uploadPhoto - Préparation de l'upload vers ${PHOTOS}/${filename}`);
      
      try {
        // Cas spécial pour les URI data (base64) sur le web
        if (Platform.OS === 'web' && processedUri.startsWith('data:')) {
          console.log(`[usePhoto] Upload base64 sur le web`);
          
          // Extraire les données base64 et le type MIME
          const matches = processedUri.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
          
          if (!matches || matches.length !== 3) {
            throw new Error('Format de données base64 invalide');
          }
          
          const contentType = matches[1];
          const base64Data = matches[2];
          
          // Vérifier la validité du base64 pour Safari iOS
          if (isSafariIOS) {
            try {
              // Vérifier si le base64 est valide en essayant de le décodifier
              const validCheck = atob(base64Data.trim());
              console.log(`[usePhoto] Base64 valide sur Safari iOS, longueur: ${validCheck.length}`);
            } catch (base64Error) {
              console.error(`[usePhoto] Base64 invalide sur Safari iOS:`, base64Error);
              throw new Error('Format base64 invalide sur Safari iOS');
            }
          }
          
          // Créer un blob à partir des données base64
          const blob = await (async () => {
            try {
              const response = await fetch(processedUri);
              if (!response.ok) {
                throw new Error(`Échec de récupération de l'image: ${response.status}`);
              }
              return response.blob();
            } catch (blobError) {
              console.error(`[usePhoto] Erreur de création de blob:`, blobError);
              
              // Méthode alternative pour créer un blob à partir de base64
              if (isSafariIOS) {
                console.log(`[usePhoto] Tentative de création alternative de blob pour Safari iOS`);
                try {
                  const byteCharacters = atob(base64Data);
                  const byteArrays = [];
                  
                  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
                    const slice = byteCharacters.slice(offset, offset + 512);
                    
                    const byteNumbers = new Array(slice.length);
                    for (let i = 0; i < slice.length; i++) {
                      byteNumbers[i] = slice.charCodeAt(i);
                    }
                    
                    const byteArray = new Uint8Array(byteNumbers);
                    byteArrays.push(byteArray);
                  }
                  
                  return new Blob(byteArrays, { type: contentType });
                } catch (altBlobError) {
                  console.error(`[usePhoto] Échec de la méthode alternative:`, altBlobError);
                  throw blobError; // Réutiliser l'erreur d'origine
                }
              } else {
                throw blobError;
              }
            }
          })();
          
          console.log(`[usePhoto] Blob créé: ${blob.size} octets`);
          
          // Upload spécifique pour Safari iOS
          if (isSafariIOS) {
            console.log(`[usePhoto] Méthode d'upload spécifique pour Safari iOS`);
            
            try {
              // Méthode 1: Upload direct en ArrayBuffer
              const arrayBuffer = await blob.arrayBuffer();
              const uint8Array = new Uint8Array(arrayBuffer);
              
              console.log(`[usePhoto] Préparation ArrayBuffer: ${uint8Array.length} octets`);
              
              const { data, error: uploadError } = await supabase.storage
                .from(PHOTOS)
                .upload(filename, uint8Array, {
                  contentType: 'image/jpeg',
                  cacheControl: '3600'
                });
                
              if (uploadError) {
                throw uploadError;
              }
              
              console.log(`[usePhoto] Upload réussi avec ArrayBuffer:`, data);
              
              // Récupérer l'URL publique
              if (data) {
                const { data: publicUrlData } = supabase.storage
                .from(PHOTOS)
                .getPublicUrl(data.path);
              
                const publicUrl = publicUrlData?.publicUrl;
                if (!publicUrl) {
                  throw new Error('Échec de la génération de l\'URL publique');
                }
                
                setState({ uri: processedUri, loading: false, error: null });
                return publicUrl;
              }
            } catch (directUploadError) {
              console.error(`[usePhoto] Échec de l'upload direct:`, directUploadError);
              
              // Si l'upload direct échoue, essayons une autre méthode
              console.log(`[usePhoto] Tentative alternative d'upload pour Safari iOS`);
              
              try {
                // Méthode 2: Upload via base64 brut
                const { data, error: uploadError } = await supabase.storage
                  .from(PHOTOS)
                  .upload(filename, decode(base64Data), {
                    contentType: 'image/jpeg',
                    cacheControl: '3600'
                  });
                  
                if (uploadError) {
                  throw uploadError;
                }
                
                console.log(`[usePhoto] Upload réussi avec base64:`, data);
                
                // Récupérer l'URL publique
                if (data) {
                  const { data: publicUrlData } = supabase.storage
                  .from(PHOTOS)
                  .getPublicUrl(data.path);
                
                  const publicUrl = publicUrlData?.publicUrl;
                  if (!publicUrl) {
                    throw new Error('Échec de la génération de l\'URL publique');
                  }
                  
                  setState({ uri: processedUri, loading: false, error: null });
                  return publicUrl;
                }
              } catch (base64UploadError) {
                console.error(`[usePhoto] Échec de l'upload base64:`, base64UploadError);
                throw base64UploadError;
              }
            }
          } else {
            // Upload standard avec le Blob pour les autres navigateurs
            const formData = new FormData();
            formData.append('file', blob, filename);
            
            const { data, error: uploadError } = await supabase.storage
              .from(PHOTOS)
              .upload(filename, formData, {
                contentType,
                cacheControl: '3600'
              });
              
            if (uploadError) {
              console.error(`[usePhoto] Erreur d'upload Supabase:`, uploadError);
              setState({ uri: null, loading: false, error: uploadError });
              throw uploadError;
            }
            
            console.log(`[usePhoto] Upload réussi:`, data);
            
            // Récupérer l'URL publique
            if (data) {
              const { data: publicUrlData } = supabase.storage
              .from(PHOTOS)
              .getPublicUrl(data.path);
            
              const publicUrl = publicUrlData?.publicUrl;
              if (!publicUrl) {
                throw new Error('Échec de la génération de l\'URL publique');
              }
              
              setState({ uri: processedUri, loading: false, error: null });
              return publicUrl;
            }
          }
        } 
        // Pour les autres plateformes
        else {
          console.log(`[usePhoto] Upload fichier local`);
          
          // Normaliser l'URI pour FileSystem
          const pathInfo = normalizePath(processedUri);
          const fileUri = pathInfo.normalizedPath;
          
          try {
            // Lire le fichier en base64 pour l'uploader
            const base64File = await FileSystem.readAsStringAsync(fileUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            
            // Upload avec l'API Supabase
      const { data, error: uploadError } = await supabase.storage
        .from(PHOTOS)
              .upload(filename, decode(base64File), {
          contentType: 'image/jpeg',
          cacheControl: '3600'
        });

      if (uploadError) {
              console.error(`[usePhoto] uploadPhoto - Erreur d'upload Supabase (native):`, uploadError);
              setState({ uri: null, loading: false, error: uploadError });
        throw uploadError;
      }

            console.log(`[usePhoto] uploadPhoto - Upload réussi:`, data);

      if (data) {
        const { data: publicUrlData } = supabase.storage
          .from(PHOTOS)
          .getPublicUrl(data.path);

        const publicUrl = publicUrlData?.publicUrl;
        if (!publicUrl) {
          throw new Error('Échec de la génération de l\'URL publique');
        }
        
        setState({ uri: processedUri, loading: false, error: null });
        return publicUrl;
            }
          } catch (fileError) {
            console.error(`[usePhoto] Erreur de lecture du fichier:`, fileError);
            setState({ uri: null, loading: false, error: fileError as Error });
            throw fileError;
          }
        }
        
      setState({ uri: processedUri, loading: false, error: null });
      return filename;
        
      } catch (uploadError) {
        console.error(`[usePhoto] Erreur pendant l'upload:`, uploadError);
        setState({ 
          uri: null, 
          loading: false, 
          error: uploadError instanceof Error ? uploadError : new Error(String(uploadError))
        });
        throw uploadError;
      }
    } catch (error) {
      console.error(`[usePhoto] Erreur globale:`, error);
      setState({ 
        uri: null, 
        loading: false, 
        error: error instanceof Error ? error : new Error(String(error))
      });
      throw error;
    }
  }, [compressImage, normalizePath]);

  return { state, loadImage, uploadPhoto, deletePhoto, compressImage };
}; 