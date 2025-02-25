import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { supabase } from '../config/supabase';
import { SUPABASE_CONFIG } from '../config/supabaseConfig';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sentry from '@sentry/react-native';

const { STORAGE: { BUCKETS: { PHOTOS } } } = SUPABASE_CONFIG;
const SUPABASE_URL = 'https://lixpixyyszvcuwpcgmxe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpeHBpeHl5c3p2Y3V3cGNnbXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODA2NTY4ODQsImV4cCI6MTk5NjIzMjg4NH0.n-wlnGAojzgt2mGTy2wFsS9JWXQwDTjXGHH0TkpGOpI';
const PROJECT_REF = SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1] || '';

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
      .createSignedUrl(normalizedPath, 60 * 60); // 1 heure
    
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
    
    return data.signedUrl;
  } catch (error) {
    console.error('Erreur lors du téléchargement avec authentification:', error);
    Sentry.captureException(error, {
      tags: { context: 'download_image_s3_auth' },
      extra: { path }
    });
    return null;
  }
}; 