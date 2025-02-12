import { useState, useEffect } from 'react';
import { Platform, ImageURISource } from 'react-native';
import { getCachedImageSource } from '../utils/imageCache';

interface UseImageLoaderOptions {
  uri?: string;
  quality?: 'NORMAL' | 'LOW' | 'HIGH';
}

export const useImageLoader = ({ uri, quality = 'NORMAL' }: UseImageLoaderOptions) => {
  const [source, setSource] = useState<ImageURISource | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!uri) {
      setSource(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const loadImage = async () => {
      try {
        if (Platform.OS === 'web') {
          setSource({ uri, cache: 'force-cache' });
        } else {
          const cachedSource = getCachedImageSource(uri, quality);
          setSource(cachedSource || { uri });
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erreur de chargement de l\'image'));
        setSource({ uri }); // Fallback à l'URL directe en cas d'erreur
      } finally {
        setIsLoading(false);
      }
    };

    void loadImage();
  }, [uri, quality]);

  return { source, isLoading, error };
}; 