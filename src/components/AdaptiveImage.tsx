import React, { useMemo } from 'react';
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
} from 'react-native';
import { useImageCache } from '../hooks/useImageCache';
import * as Sentry from '@sentry/react-native';

interface AdaptiveImageProps {
  uri?: string;
  style?: StyleProp<ImageStyle>;
  placeholder?: any;
  cacheKey?: string;
  resizeMode?: ImageResizeMode;
  defaultWidth?: number;
  defaultHeight?: number;
  onError?: () => void;
}

const DEFAULT_SIZE = 200;

const AdaptiveImage: React.FC<AdaptiveImageProps> = React.memo(({
  uri,
  style,
  placeholder,
  cacheKey,
  resizeMode = 'cover',
  defaultWidth = DEFAULT_SIZE,
  defaultHeight = DEFAULT_SIZE,
  onError,
}) => {
  const { imagePath, loading, error } = useImageCache(uri, cacheKey);

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
    Sentry.addBreadcrumb({
      category: 'image_error',
      message: 'Erreur de chargement d\'image',
      data: { uri, cacheKey },
    });
    onError?.();
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

  if (error || !imagePath) {
    return (
      <View style={[containerStyle, styles.errorContainer]}>
        {placeholderImage ? (
          <Image
            source={placeholderImage}
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
    <View style={containerStyle}>
      <Image
        source={{ uri: imagePath }}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        onError={() => {
          Sentry.captureMessage('Erreur de rendu d\'image', {
            level: 'warning',
            extra: { uri: imagePath }
          });
          onError?.();
        }}
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
  iosLoadingOverlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)'
  }
});

AdaptiveImage.displayName = 'AdaptiveImage';

export default AdaptiveImage; 