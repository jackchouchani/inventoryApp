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
  Text,
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
  const { loadImage } = usePhoto();
  const [imageState, setImageState] = useState<{
    cachedUri: string | null;
    loading: boolean;
    error: Error | null;
    isLocalImage: boolean;
  }>({
    cachedUri: null,
    loading: true,
    error: null,
    isLocalImage: false
  });

  useEffect(() => {
    if (!uri) {
      setImageState({
        cachedUri: null,
        loading: false,
        error: new Error('URI manquante'),
        isLocalImage: false
      });
      return;
    }

    // Vérifier si c'est une image locale (blob ou data URI)
    const isLocalUri = uri.startsWith('blob:') || uri.startsWith('data:');
    
    if (isLocalUri) {
      setImageState({
        cachedUri: uri,
        loading: false,
        error: null,
        isLocalImage: true
      });
      return;
    }
    
    // Détecter les URL Supabase
    const isSupabaseUrl = uri.includes('supabase.co/storage');
    
    // Pour les URLs Supabase, on vérifie qu'elles sont valides
    if (isSupabaseUrl && uri.includes('/public/') && !uri.includes('/sign/')) {
      // Mettre directement l'URL comme URI mise en cache
      setImageState({
        cachedUri: uri,
        loading: false,
        error: null,
        isLocalImage: false
      });
      return;
    }
    
    // Pour toutes les autres URLs, utiliser loadImage
    setImageState(prev => ({ ...prev, loading: true }));
    
    loadImage(uri)
      .then(cachedUri => {
        if (cachedUri) {
          setImageState({
            cachedUri,
            loading: false,
            error: null,
            isLocalImage: false
          });
        } else {
          // Si cachedUri est null, c'est une erreur
          setImageState({
            cachedUri: null,
            loading: false,
            error: new Error(`Impossible de charger l'image: ${uri}`),
            isLocalImage: false
          });
        }
      })
      .catch(err => {
        console.error("[AdaptiveImage] Erreur de chargement:", err);
        setImageState({
          cachedUri: null,
          loading: false,
          error: err,
          isLocalImage: false
        });
      });
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

  // Détecter Safari iOS
  const isSafariIOS = useMemo(() => {
    if (Platform.OS !== 'web') return false;
    
    return typeof navigator !== 'undefined' && 
      (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (/^((?!chrome|android).)*safari/i.test(navigator.userAgent) && 
      /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent)));
  }, []);

  if (imageState.error) {
    console.error(`[AdaptiveImage] Erreur détectée pour l'article ${props.testID || 'inconnu'}:`, 
      imageState.error.message || 'Erreur inconnue');
    
    Sentry.addBreadcrumb({
      category: 'image_error',
      message: 'Erreur de chargement d\'image',
      data: { uri, cacheKey },
    });
    
    // Tenter de réparer l'URL Supabase cassée (remplacer sign par public)
    if (uri && uri.includes('supabase.co/storage') && uri.includes('/sign/') && !imageState.isLocalImage) {
      // Si c'est une URL signée expirée, essayer de la convertir en URL publique
      const publicUrl = uri.replace('/object/sign/', '/object/public/');
      console.log(`[AdaptiveImage] Tentative de réparation d'URL: ${publicUrl.substring(0, 50)}...`);
      
      // Ce test simple pourrait être remplacé par une tentative réelle de chargement
      // mais nous éviterons cela pour des raisons de performance
      if (!imageState.cachedUri && publicUrl !== uri) {
        // On peut essayer de recharger avec cette URL
        return (
          <Image 
            source={{ uri: publicUrl }} 
            style={style as StyleProp<ImageStyle>}
            resizeMode={resizeMode}
            onError={() => onError?.()}
            {...props}
          />
        );
      }
    }
    
    if (onError) {
      onError();
    }
  }

  // Si c'est une image locale (blob ou data URI), l'afficher directement
  if (imageState.isLocalImage && imageState.cachedUri) {
    return (
      <View style={containerStyle}>
        <Image
          source={{ uri: imageState.cachedUri }}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode}
          onError={(e) => {
            console.error("[AdaptiveImage] Erreur de rendu d'image locale:", e.nativeEvent.error);
            Sentry.captureMessage('Erreur de rendu d\'image locale', {
              level: 'warning',
              extra: { uri: imageState.cachedUri }
            });
            onError?.();
          }}
          {...props}
        />
      </View>
    );
  }

  if (imageState.loading) {
    return (
      <View style={containerStyle}>
        <ActivityIndicator size="small" color={activeTheme.text.secondary} />
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

  if (imageState.error || !imageState.cachedUri) {
    // Si Safari iOS, afficher un message d'erreur plus spécifique en dev
    if (__DEV__ && isSafariIOS) {
      console.warn(`[AdaptiveImage][Safari iOS] Échec de chargement pour: ${uri?.substring(0, 50)}...`);
    }
    
    return fallbackSource ? (
      <Image source={fallbackSource} style={style} {...props} />
    ) : placeholder || (
      <View style={[containerStyle, styles.errorContainer]}>
        <Text style={styles.errorText}>Image non disponible</Text>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <Image
        source={{ uri: imageState.cachedUri }}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        onError={(e) => {
          console.error("[AdaptiveImage] Erreur de rendu d'image:", e.nativeEvent.error);
          Sentry.captureMessage('Erreur de rendu d\'image', {
            level: 'warning',
            extra: { uri: imageState.cachedUri, originalUri: uri }
          });
          onError?.();
        }}
        {...props}
      />
      {Platform.OS === 'ios' && imageState.loading && (
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 12,
    fontWeight: '500',
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