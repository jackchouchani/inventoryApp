import React, { useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Item } from '../types/item';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { SharedValue } from 'react-native-reanimated';
import { AnimationConfig } from '../hooks/useAnimatedComponents';
import AdaptiveImage from './AdaptiveImage';

export interface ItemCardProps {
  item: Item;
  onPress?: (item: Item) => void;
  onMarkAsSold?: (itemId: number) => void;
  onMarkAsAvailable?: (itemId: number) => void;
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
  const handlePress = useCallback(() => {
    onPress?.(item);
  }, [item, onPress]);

  const handlePressIn = useCallback(() => {
    scaleAnimation?.scaleUp();
  }, [scaleAnimation]);

  const handlePressOut = useCallback(() => {
    scaleAnimation?.scaleDown();
  }, [scaleAnimation]);

  const handleMarkAsSold = useCallback(() => {
    onMarkAsSold?.(item.id);
  }, [item.id, onMarkAsSold]);

  const handleMarkAsAvailable = useCallback(() => {
    onMarkAsAvailable?.(item.id);
  }, [item.id, onMarkAsAvailable]);

  useEffect(() => {
    fadeAnimation?.fadeIn();
  }, []);

  return (
    <Animated.View 
      style={[
        styles.container, 
        scaleAnimation?.scaleStyle,
        fadeAnimation?.fadeStyle
      ]}
    >
      <TouchableOpacity 
        style={styles.cardContent}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.imageContainer}>
          {item.photo_storage_url ? (
            <AdaptiveImage
              uri={item.photo_storage_url}
              style={styles.itemImage}
              resizeMode="cover"
              defaultWidth={80}
              defaultHeight={80}
              placeholder={
                <View style={styles.placeholderContainer}>
                  <MaterialIcons name="image" size={24} color="#ccc" />
                </View>
              }
            />
          ) : (
            <View style={[styles.itemImage, styles.noImageContainer]}>
              <MaterialIcons name="image-not-supported" size={24} color="#ccc" />
            </View>
          )}
        </View>

        <View style={styles.detailsContainer}>
          <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.itemPrice}>{item.sellingPrice}€</Text>
          <View style={[styles.statusBadge, item.status === 'sold' ? styles.soldBadge : styles.availableBadge]}>
            <Text style={styles.statusText}>
              {item.status === 'sold' ? 'Vendu' : 'Disponible'}
            </Text>
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardContent: {
    flexDirection: 'row',
    padding: 12,
  },
  imageContainer: {
    marginRight: 12,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  noImageContainer: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
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
});

ItemCard.displayName = 'ItemCard';

export default React.memo(ItemCard); 