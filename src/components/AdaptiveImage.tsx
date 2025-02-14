import React, { useState, useEffect, memo } from 'react';
import {
  Image,
  ImageStyle,
  Platform,
  View,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as FileSystem from 'expo-file-system';

interface AdaptiveImageProps {
  uri?: string;
  style?: ImageStyle;
  placeholder?: any;
  cacheKey?: string;
}

const IMAGE_CACHE_FOLDER = `${FileSystem.cacheDirectory}image_cache/`;

const AdaptiveImage: React.FC<AdaptiveImageProps> = memo(({
  uri,
  style,
  placeholder,
  cacheKey,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imagePath, setImagePath] = useState<string | null>(null);

  useEffect(() => {
    const setupCache = async () => {
      try {
        const folder = await FileSystem.getInfoAsync(IMAGE_CACHE_FOLDER);
        if (!folder.exists) {
          await FileSystem.makeDirectoryAsync(IMAGE_CACHE_FOLDER);
        }
      } catch (e) {
        console.warn('Erreur lors de la création du dossier de cache:', e);
      }
    };

    setupCache();
  }, []);

  useEffect(() => {
    const loadImage = async () => {
      if (!uri) {
        setLoading(false);
        setError(true);
        return;
      }

      try {
        setLoading(true);
        setError(false);

        const filename = cacheKey || uri.split('/').pop();
        const cacheFilePath = `${IMAGE_CACHE_FOLDER}${filename}`;

        // Vérifier si l'image est déjà en cache
        const cacheInfo = await FileSystem.getInfoAsync(cacheFilePath);
        
        if (cacheInfo.exists) {
          setImagePath(cacheFilePath);
          setLoading(false);
          return;
        }

        // Télécharger et mettre en cache
        await FileSystem.downloadAsync(uri, cacheFilePath);
        setImagePath(cacheFilePath);
      } catch (e) {
        console.error('Erreur lors du chargement de l\'image:', e);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [uri, cacheKey]);

  if (loading) {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator size="small" color="#999" />
        {placeholder && (
          <Image
            source={typeof placeholder === 'string' ? { uri: placeholder } : placeholder}
            style={[StyleSheet.absoluteFill, { opacity: 0.5 }]}
            blurRadius={Platform.OS === 'ios' ? 10 : 5}
          />
        )}
      </View>
    );
  }

  if (error || !imagePath) {
    return (
      <View style={[styles.container, style, styles.errorContainer]}>
        {placeholder ? (
          <Image
            source={typeof placeholder === 'string' ? { uri: placeholder } : placeholder}
            style={StyleSheet.absoluteFill}
            blurRadius={Platform.OS === 'ios' ? 10 : 5}
          />
        ) : (
          <View style={styles.errorIcon} />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Image
        source={{ uri: imagePath }}
        style={StyleSheet.absoluteFill}
        onError={() => setError(true)}
      />
      {Platform.OS === 'ios' && loading && (
        <View 
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(255, 255, 255, 0.7)' }
          ]}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
  },
  errorIcon: {
    width: 24,
    height: 24,
    backgroundColor: '#ef5350',
    borderRadius: 12,
  },
});

AdaptiveImage.displayName = 'AdaptiveImage';

export default AdaptiveImage; 