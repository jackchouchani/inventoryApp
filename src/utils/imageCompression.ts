import { Platform, Alert } from 'react-native';
import { MAX_PHOTO_SIZE } from '../constants/photos';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Compresse une image en utilisant Canvas API pour le web et expo-image-manipulator pour les plateformes natives
 * 
 * @param uri Image au format data:image/xxx;base64,xxx ou chemin de fichier
 * @returns Promise avec l'image compressée
 */
export const compressImage = async (uri: string): Promise<string> => {
  if (!uri) {
    console.error('[imageCompression] URI d\'image non fourni');
    return uri;
  }
  
  console.log('[imageCompression] Début compression');
  
  try {
    // Utiliser Canvas pour la compression sur le web (particulièrement pour iOS Safari)
    if (Platform.OS === 'web' && uri.startsWith('data:')) {
      return await compressImageWithCanvas(uri);
    }
    
    // Pour les plateformes natives, utiliser expo-image-manipulator
    let quality = 0.85;
    let maxWidth = 1200;
    let maxHeight = 1200;
    
    console.log(`[imageCompression] Compression avec qualité ${quality*100}%, taille max ${maxWidth}x${maxHeight}`);
    
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: maxWidth, height: maxHeight } }],
      { compress: quality, format: SaveFormat.JPEG }
    );
    
    console.log('[imageCompression] Compression terminée');
    return result.uri;
    
  } catch (error) {
    console.error('[imageCompression] Erreur lors de la compression:', error);
    // En cas d'erreur, retourner l'image originale
    return uri;
  }
};

/**
 * Compresse une image en utilisant Canvas API (spécifique au web)
 * Cette méthode est plus fiable sur Safari iOS
 */
const compressImageWithCanvas = async (dataUri: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.onload = () => {
        // Déterminer les dimensions optimales (max 1200px)
        let width = img.width;
        let height = img.height;
        const maxDimension = 1200;
        
        if (width > height && width > maxDimension) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else if (height > maxDimension) {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }
        
        // Créer un canvas pour la compression
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          console.error('[imageCompression] Impossible de créer le contexte 2D');
          resolve(dataUri); // Retourner l'original en cas d'échec
          return;
        }
        
        // Dessiner l'image sur le canvas
        ctx.drawImage(img, 0, 0, width, height);
        
        // Déterminer la qualité de compression en fonction de la taille originale
        let quality = 0.85;
        const base64Data = dataUri.split(',')[1] || '';
        const initialSize = (base64Data.length * 3) / 4;
        
        if (initialSize > 10 * 1024 * 1024) { // > 10MB
          quality = 0.6;
        } else if (initialSize > 5 * 1024 * 1024) { // > 5MB
          quality = 0.7;
        } else if (initialSize > 2 * 1024 * 1024) { // > 2MB
          quality = 0.75;
        } else if (initialSize <= MAX_PHOTO_SIZE) {
          // Si c'est déjà assez petit, compression légère
          quality = 0.9;
        }
        
        console.log(`[imageCompression] Canvas: compression avec qualité ${quality*100}%`);
        
        // Extraire le type MIME de l'URI d'origine
        const mimeType = dataUri.split(';')[0].split(':')[1] || 'image/jpeg';
        
        // Convertir en JPEG pour une meilleure compression
        const compressedDataUri = canvas.toDataURL('image/jpeg', quality);
        
        console.log('[imageCompression] Canvas: compression terminée');
        
        // Vérifier si la compression a vraiment réduit la taille
        const compressedBase64 = compressedDataUri.split(',')[1] || '';
        const compressedSize = (compressedBase64.length * 3) / 4;
        
        if (compressedSize >= initialSize) {
          console.log('[imageCompression] La compression n\'a pas réduit la taille, retour à l\'original');
          resolve(dataUri);
        } else {
          console.log(`[imageCompression] Taille réduite: ${Math.round(initialSize/1024)}KB → ${Math.round(compressedSize/1024)}KB`);
          resolve(compressedDataUri);
        }
      };
      
      img.onerror = (error) => {
        console.error('[imageCompression] Erreur de chargement de l\'image:', error);
        resolve(dataUri); // Retourner l'original en cas d'erreur
      };
      
      // Safari peut avoir des problèmes avec certaines images, ajouter un timeout
      setTimeout(() => {
        img.src = dataUri;
      }, 0);
      
    } catch (error) {
      console.error('[imageCompression] Erreur lors de la compression par Canvas:', error);
      resolve(dataUri); // Retourner l'original en cas d'erreur
    }
  });
};

/**
 * Vérifie si une image base64 est valide et récupère ses informations
 */
export const getBase64ImageInfo = (dataUri: string): { 
  isValid: boolean; 
  sizeKB?: number; 
} => {
  try {
    if (!dataUri || !dataUri.startsWith('data:image/')) {
      return { isValid: false };
    }
    
    const matches = dataUri.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return { isValid: false };
    }
    
    const base64Data = matches[2];
    const sizeKB = ((base64Data.length * 3) / 4) / 1024;
    
    return { 
      isValid: true,
      sizeKB: Math.round(sizeKB * 100) / 100
    };
  } catch (error) {
    console.error('[imageCompression] Erreur lors de l\'analyse de l\'image:', error);
    return { isValid: false };
  }
}; 