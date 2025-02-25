import { supabase } from '../config/supabase';
import { SUPABASE_CONFIG } from '../config/supabaseConfig';

// Constante pour le nom du bucket photos
const { STORAGE: { BUCKETS: { PHOTOS } } } = SUPABASE_CONFIG;

/**
 * Convertit une URL signée Supabase en nom de fichier
 * @param signedUrl L'URL signée complète
 * @returns Le nom du fichier extrait
 */
export const extractFilenameFromSignedUrl = (signedUrl: string): string => {
  if (!signedUrl) return '';
  
  const isSignedUrl = signedUrl.includes('/object/sign/') && signedUrl.includes('?token=');
  
  if (isSignedUrl) {
    // Extrait le nom du fichier d'une URL signée (tout ce qui est entre le dernier / avant le ? et le ?)
    const filenameMatch = signedUrl.match(/\/([^\/]+)\?/);
    if (filenameMatch && filenameMatch[1]) {
      return filenameMatch[1];
    }
  }
  
  // Fallback: essayer d'extraire le dernier segment du chemin
  return signedUrl.split('/').pop()?.split('?')[0] || '';
};

/**
 * Récupère une URL publique pour un fichier dans le bucket d'images
 * @param filenameOrUrl Le nom du fichier ou une URL complète
 * @returns Promise contenant l'URL publique ou null en cas d'erreur
 */
export const getPublicImageUrl = async (filenameOrUrl: string): Promise<string | null> => {
  try {
    if (!filenameOrUrl) return null;
    
    // Si c'est une URL signée, extraire le nom du fichier
    const filename = extractFilenameFromSignedUrl(filenameOrUrl);
    
    if (!filename) return null;
    
    const { data } = supabase.storage
      .from(PHOTOS)
      .getPublicUrl(filename);
      
    return data?.publicUrl || null;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'URL publique:', error);
    return null;
  }
};

/**
 * Vérifie si une URL est une URL signée Supabase
 * @param url L'URL à vérifier
 * @returns true si c'est une URL signée
 */
export const isSignedSupabaseUrl = (url: string): boolean => {
  if (!url) return false;
  return url.includes('/object/sign/') && url.includes('?token=');
};

/**
 * Vérifie si une URL signée est expirée en décodant le token JWT
 * @param signedUrl L'URL signée complète
 * @returns true si l'URL est expirée, false sinon
 */
export const isSignedUrlExpired = (signedUrl: string): boolean => {
  try {
    if (!isSignedSupabaseUrl(signedUrl)) return false;
    
    // Extraire le token JWT
    const tokenMatch = signedUrl.match(/\?token=([^&]+)/);
    if (!tokenMatch || !tokenMatch[1]) return true;
    
    const token = tokenMatch[1];
    
    // Décoder la partie payload du JWT (2ème partie)
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    // Utiliser une fonction de décodage base64 compatible web/mobile
    const base64Decode = (str: string): string => {
      try {
        // Browser
        if (typeof window !== 'undefined' && window.atob) {
          return window.atob(str);
        }
        
        // Node.js ou React Native
        return Buffer.from(str, 'base64').toString('ascii');
      } catch (e) {
        console.error('Erreur lors du décodage base64:', e);
        return '';
      }
    };
    
    // Décodage du payload
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payloadJson = base64Decode(payloadBase64);
    if (!payloadJson) return true;
    
    const payload = JSON.parse(payloadJson);
    
    // Vérifier l'expiration
    const expirationTime = payload.exp * 1000; // Convertir en millisecondes
    const currentTime = Date.now();
    
    
    return currentTime > expirationTime;
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'expiration de l\'URL:', error);
    return true; // En cas d'erreur, considérer comme expiré par sécurité
  }
}; 