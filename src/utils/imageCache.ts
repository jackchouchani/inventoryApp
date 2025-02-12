import FastImage from 'react-native-fast-image';
import { Item } from '../database/types';

export const ImagePriority = {
  LOW: FastImage.priority.low,
  NORMAL: FastImage.priority.normal,
  HIGH: FastImage.priority.high,
} as const;

interface ImageLoadError {
  uri: string;
  error: Error;
  timestamp: number;
}

const failedImages = new Map<string, ImageLoadError>();
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 5000; // 5 secondes

// Configuration du cache FastImage
export const configureFastImage = () => {
  FastImage.clearMemoryCache();
  FastImage.clearDiskCache();
};

// Gestion des erreurs de chargement d'image
const handleImageLoadError = (uri: string, error: Error) => {
  const existingError = failedImages.get(uri);
  if (existingError) {
    existingError.timestamp = Date.now();
  } else {
    failedImages.set(uri, {
      uri,
      error,
      timestamp: Date.now(),
    });
  }
};

// Vérification si une image peut être réessayée
const canRetryImage = (uri: string): boolean => {
  const failedImage = failedImages.get(uri);
  if (!failedImage) return true;

  const timeSinceLastAttempt = Date.now() - failedImage.timestamp;
  return timeSinceLastAttempt >= RETRY_DELAY;
};

// Nettoyage des erreurs anciennes
const cleanupFailedImages = () => {
  const now = Date.now();
  failedImages.forEach((error, uri) => {
    if (now - error.timestamp > RETRY_DELAY * MAX_RETRY_ATTEMPTS) {
      failedImages.delete(uri);
    }
  });
};

// Préchargement des images avec gestion d'erreur
export const preloadImages = (items: Item[]) => {
  cleanupFailedImages();

  const imagesToPreload = items
    .filter(item => item.photoUri && canRetryImage(item.photoUri))
    .map(item => ({
      uri: item.photoUri as string,
      priority: ImagePriority.NORMAL,
    }));

  FastImage.preload(imagesToPreload);
};

// Préchargement d'une seule image avec gestion d'erreur
export const preloadImage = (uri: string, priority: keyof typeof ImagePriority = 'NORMAL') => {
  if (!canRetryImage(uri)) return;

  FastImage.preload([{
    uri,
    priority: ImagePriority[priority],
  }]);
};

// Configuration des en-têtes d'authentification pour les images
export const setImageAuthHeaders = (headers: { [key: string]: string }) => {
  // FastImage n'a pas de méthode directe pour définir les en-têtes par défaut
  // On utilise donc les en-têtes dans la source de l'image
  return {
    headers: {
      Authorization: headers.Authorization || ''
    }
  };
};

// Composant de cache d'image réutilisable avec gestion d'erreur
export const getCachedImageSource = (
  uri: string,
  priority: keyof typeof ImagePriority = 'NORMAL',
  headers?: { [key: string]: string },
  onError?: (error: Error) => void
) => {
  if (!canRetryImage(uri)) {
    const error = failedImages.get(uri);
    if (error && onError) {
      onError(error.error);
    }
    return null;
  }

  return {
    uri,
    priority: ImagePriority[priority],
    cache: FastImage.cacheControl.immutable,
    ...(headers ? { headers } : {}),
    onError: (error: Error) => {
      handleImageLoadError(uri, error);
      if (onError) onError(error);
    },
  };
}; 