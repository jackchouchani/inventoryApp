import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image, ActivityIndicator } from 'react-native';
import { Item } from '../types/item';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { SharedValue } from 'react-native-reanimated';
import { AnimationConfig } from '../hooks/useAnimatedComponents';
import { getImageUrl } from '../utils/r2Client';

export interface ItemCardProps {
  item: Item;
  onPress?: (item: Item) => void;
  onMarkAsSold?: (item: Item) => void;
  onMarkAsAvailable?: (item: Item) => void;
  fadeAnimation?: {
    opacity: SharedValue<number>;
    fadeIn: (config?: AnimationConfig) => void;
    fadeOut: (config?: AnimationConfig) => void;
    fadeStyle: { opacity: number };
  };
  scaleAnimation?: {
    scale: SharedValue<number>;
    scaleUp: (config?: AnimationConfig) => void;
    scaleDown: (config?: AnimationConfig) => void;
    scaleStyle: { transform: { scale: number }[] };
  };
}

const ItemCard: React.FC<ItemCardProps> = ({ 
  item, 
  onPress,
  onMarkAsSold,
  onMarkAsAvailable,
  fadeAnimation,
  scaleAnimation
}) => {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(item.status);

  const handlePress = useCallback(() => {
    onPress?.(item);
  }, [item, onPress]);

  const handlePressIn = useCallback(() => {
    scaleAnimation?.scaleUp({ duration: 150 });
  }, [scaleAnimation]);

  const handlePressOut = useCallback(() => {
    scaleAnimation?.scaleDown({ duration: 150 });
  }, [scaleAnimation]);

  const handleMarkAsSold = useCallback(() => {
    setLocalStatus('sold');
    onMarkAsSold?.(item);
  }, [item, onMarkAsSold]);

  const handleMarkAsAvailable = useCallback(() => {
    setLocalStatus('available');
    onMarkAsAvailable?.(item);
  }, [item, onMarkAsAvailable]);

  const animatedStyle = useMemo(() => [
    styles.container,
    scaleAnimation?.scaleStyle,
    fadeAnimation?.fadeStyle
  ], [scaleAnimation?.scaleStyle, fadeAnimation?.fadeStyle]);

  const statusStyle = useMemo(() => [
    styles.statusBadge,
    localStatus === 'sold' ? styles.soldBadge : styles.availableBadge
  ], [localStatus]);

  const statusTextStyle = useMemo(() => [
    styles.statusText,
    { color: localStatus === 'sold' ? '#c62828' : '#2e7d32' }
  ], [localStatus]);

  useEffect(() => {
    fadeAnimation?.fadeIn({ duration: 300 });
  }, [fadeAnimation]);

  useEffect(() => {
    if (item.photo_storage_url) {
      setIsLoading(true);
      setErrorMessage(null);
      // Utiliser getImageUrl pour générer l'URL Cloudflare R2
      const url = getImageUrl(item.photo_storage_url);
      setLocalUri(url);
      setIsLoading(false);
    } else {
      setLocalUri(null);
    }
  }, [item.photo_storage_url, item.id]);

  useEffect(() => {
    setLocalStatus(item.status);
  }, [item.status]);

  const renderImageContent = () => {
    if (isLoading) {
      return (
        <View style={[styles.image, styles.noImageContainer]}>
          <ActivityIndicator size="small" color="#2196f3" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      );
    }
    
    if (errorMessage) {
      return (
        <View style={[styles.image, styles.noImageContainer]}>
          <MaterialIcons name="error-outline" size={24} color="#e53935" />
          <Text style={styles.errorText}>Erreur</Text>
          <Text style={styles.errorDetail}>{errorMessage.substring(0, 25)}</Text>
        </View>
      );
    }
    
    if (localUri) {
      // Ajouter un paramètre unique pour contourner le cache du navigateur si nécessaire
      const imageUri = Platform.OS === 'web' && !localUri.includes('_cache_bust=') 
        ? `${localUri}${localUri.includes('?') ? '&' : '?'}_cache_bust=${item.id}`
        : localUri;
        
      return (
        <Image 
          source={{ uri: imageUri }} 
          style={styles.image}
          // Désactiver le cache intégré de React Native Image sur le web
          {...(Platform.OS === 'web' ? { 
            // @ts-ignore - Ces propriétés ne sont pas dans les types mais fonctionnent sur le web
            loading: "eager",
            fetchPriority: "high",
            imageCachePolicy: "no-store" 
          } : {})}
          onError={(e) => {
            console.error(`Erreur de rendu d'image pour l'article ${item.id}:`, e.nativeEvent.error);
            setErrorMessage(`Erreur de rendu: ${e.nativeEvent.error}`);
          }}
        />
      );
    }
    
    return (
      <View style={[styles.image, styles.noImageContainer]}>
        <MaterialIcons name="image-not-supported" size={24} color="#999" />
      </View>
    );
  };

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity 
        style={styles.cardContent}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
      >
        <View style={styles.imageContainer}>
          {renderImageContent()}
        </View>

        <View style={styles.detailsContainer}>
          <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.itemPrice}>{item.sellingPrice}€</Text>
          <View style={styles.bottomRow}>
            <View style={statusStyle}>
              <Text style={statusTextStyle}>
                {localStatus === 'sold' ? 'Vendu' : 'Disponible'}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.statusToggleButton,
                localStatus === 'sold' ? styles.restoreButton : styles.sellButton
              ]}
              onPress={localStatus === 'sold' ? handleMarkAsAvailable : handleMarkAsSold}
            >
              <MaterialIcons
                name={localStatus === 'sold' ? 'restore' : 'shopping-cart'}
                size={16}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: Platform.select({ android: 2, default: 0 }),
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  },
  cardContent: {
    flexDirection: 'row',
    padding: 12,
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2196f3',
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  statusToggleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sellButton: {
    backgroundColor: '#2196f3',
  },
  restoreButton: {
    backgroundColor: '#ff9800',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  availableBadge: {
    backgroundColor: '#e8f5e9',
  },
  soldBadge: {
    backgroundColor: '#ffebee',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#e53935',
    marginTop: 4,
  },
  errorDetail: {
    fontSize: 9,
    color: '#e53935',
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: 4,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2196f3',
    marginTop: 4,
  },
});

export default React.memo(ItemCard, (prevProps, nextProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.status === nextProps.item.status
  );
}); 