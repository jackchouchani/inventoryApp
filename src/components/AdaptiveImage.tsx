import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ImageStyle,
  Platform,
  View,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  ImageResizeMode,
  StyleProp,
  ImageProps,
} from 'react-native';
import { usePhoto } from '../hooks/usePhoto';
import * as Sentry from '@sentry/react-native';

interface AdaptiveImageProps extends Omit<ImageProps, 'source'> {
  uri?: string;
  style?: StyleProp<ImageStyle>;
  placeholder?: any;
  cacheKey?: string;
  resizeMode?: ImageResizeMode;
  defaultWidth?: number;
  defaultHeight?: number;
  onError?: () => void;
  fallbackSource?: ImageProps['source'];
}

const DEFAULT_SIZE = 200;

export const AdaptiveImage: React.FC<AdaptiveImageProps> = ({
  uri,
  style,
  placeholder,
  cacheKey,
  resizeMode = 'cover',
  defaultWidth = DEFAULT_SIZE,
  defaultHeight = DEFAULT_SIZE,
  onError,
  fallbackSource,
  ...props
}) => {
  const { uri: cachedUri, loading, error, loadImage } = usePhoto();
  const [isLocalImage, setIsLocalImage] = useState(false);

  useEffect(() => {
    if (!uri) return;

    // Vérifier si c'est une image locale (blob ou data URI)
    const isLocalUri = uri.startsWith('blob:') || uri.startsWith('data:');
    
    if (isLocalUri) {
      setIsLocalImage(true);
      return;
    }
    
    loadImage(uri, cacheKey).catch(err => 
      console.error("[AdaptiveImage] Erreur de chargement:", err)
    );
  }, [uri, cacheKey, loadImage]);

  const containerStyle = useMemo<StyleProp<ViewStyle>>(() => {
    const flatStyle = StyleSheet.flatten(style) || {};
    return [
      styles.container,
      style,
      {
        width: flatStyle.width || defaultWidth,
        height: flatStyle.height || defaultHeight,
      }
    ];
  }, [style, defaultWidth, defaultHeight]);

  const placeholderImage = useMemo(() => {
    if (!placeholder) return null;
    return typeof placeholder === 'string' ? { uri: placeholder } : placeholder;
  }, [placeholder]);

  if (error) {
    console.error("[AdaptiveImage] Erreur détectée:", error);
    Sentry.addBreadcrumb({
      category: 'image_error',
      message: 'Erreur de chargement d\'image',
      data: { uri, cacheKey },
    });
    onError?.();
  }

  // Si c'est une image locale (blob ou data URI), l'afficher directement
  if (isLocalImage && uri) {
    return (
      <View style={containerStyle}>
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode}
          onError={(e) => {
            console.error("[AdaptiveImage] Erreur de rendu d'image locale:", e.nativeEvent.error);
            Sentry.captureMessage('Erreur de rendu d\'image locale', {
              level: 'warning',
              extra: { uri }
            });
            onError?.();
          }}
          {...props}
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={containerStyle}>
        <ActivityIndicator size="small" color="#999" />
        {placeholderImage && (
          <Image
            source={placeholderImage}
            style={[StyleSheet.absoluteFill, { opacity: 0.5 }]}
            blurRadius={Platform.OS === 'ios' ? 10 : 5}
          />
        )}
      </View>
    );
  }

  if (error || !cachedUri) {
    return fallbackSource ? (
      <Image source={fallbackSource} style={style} {...props} />
    ) : placeholder || null;
  }

  return (
    <View style={containerStyle}>
      <Image
        source={{ uri: cachedUri }}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        onError={(e) => {
          console.error("[AdaptiveImage] Erreur de rendu d'image:", e.nativeEvent.error);
          Sentry.captureMessage('Erreur de rendu d\'image', {
            level: 'warning',
            extra: { uri: cachedUri, originalUri: uri }
          });
          onError?.();
        }}
        {...props}
      />
      {Platform.OS === 'ios' && loading && (
        <View 
          style={[
            StyleSheet.absoluteFill,
            styles.iosLoadingOverlay
          ]}
        />
      )}
    </View>
  );
};

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
  iosLoadingOverlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)'
  }
});

AdaptiveImage.displayName = 'AdaptiveImage';

export default AdaptiveImage; 