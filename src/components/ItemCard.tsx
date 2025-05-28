import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image, ActivityIndicator } from 'react-native';
import { Item } from '../types/item';
import { Icon } from '../../src/components';
import Animated, { SharedValue } from 'react-native-reanimated';
import { AnimationConfig } from '../hooks/useAnimatedComponents';
import { getImageUrl } from '../utils/r2Client';
import { useAppTheme, type AppThemeType } from '../contexts/ThemeContext';
import { useRouter } from 'expo-router';

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
  onMarkAsSold,
  onMarkAsAvailable,
  fadeAnimation,
  scaleAnimation
}) => {
  const { activeTheme } = useAppTheme();
  const styles = useMemo(() => getThemedStyles(activeTheme), [activeTheme]);
  const router = useRouter();
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(item.status);

  const handlePress = useCallback(() => {
    // Priorité 1: Utiliser la nouvelle route dédiée
    router.push(`/item/${item.id}/info`);
    
    // Priorité 2: Fallback vers l'ancienne méthode si fournie
    // onPress?.(item);
  }, [item.id, router]);

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
    { color: localStatus === 'sold' ? activeTheme.text.inverse : activeTheme.text.inverse }
  ], [localStatus, activeTheme]);

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
          <ActivityIndicator size="small" color={activeTheme.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      );
    }
    
    if (errorMessage) {
      return (
        <View style={[styles.image, styles.noImageContainer]}>
          <Icon name="error_outline" size={24} color={activeTheme.danger.text} />
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
        <Icon name="image_not_supported" size={24} color={activeTheme.text.secondary} />
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
              <Icon
                name={localStatus === 'sold' ? 'restore' : 'shopping_cart'}
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

const getThemedStyles = (theme: AppThemeType) => StyleSheet.create({
  container: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: Platform.select({ android: theme.shadows.sm.elevation, default: 0 }),
    boxShadow: theme.shadows.sm.boxShadow,
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
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
    color: theme.text.primary,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: theme.typography.body.fontSize - 1,
    fontWeight: '500',
    color: theme.primary,
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
    backgroundColor: theme.primary,
  },
  restoreButton: {
    backgroundColor: theme.warning,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  availableBadge: {
    backgroundColor: theme.success,
  },
  soldBadge: {
    backgroundColor: theme.danger.text,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.danger.main,
    marginTop: 4,
  },
  errorDetail: {
    fontSize: 9,
    color: theme.danger.main,
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: 4,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.primary,
    marginTop: 4,
  },
});

const MemoizedItemCard = React.memo(ItemCard, (prevProps, nextProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.status === nextProps.item.status
  );
});

export default MemoizedItemCard;