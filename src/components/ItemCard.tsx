import React, { useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Item } from '../types/item';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { SharedValue } from 'react-native-reanimated';
import { AnimationConfig } from '../hooks/useAnimatedComponents';

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
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.touchable}
      >
        <View style={styles.content}>
          {item.photo_storage_url && (
            <Image 
              source={{ uri: item.photo_storage_url }} 
              style={styles.image}
              resizeMode="cover"
            />
          )}
          <View style={styles.info}>
            <Text style={styles.name}>{item.name}</Text>
            {item.description && (
              <Text style={styles.description} numberOfLines={2}>
                {item.description}
              </Text>
            )}
            <View style={styles.footer}>
              <View style={styles.priceContainer}>
                <Text style={styles.price}>
                  {item.sellingPrice !== undefined && item.sellingPrice !== null
                    ? `${Number(item.sellingPrice).toFixed(2)} €`
                    : 'Prix non défini'}
                </Text>
              </View>
              {item.status === 'available' ? (
                <TouchableOpacity 
                  style={[styles.statusButton, styles.soldButton]}
                  onPress={handleMarkAsSold}
                >
                  <MaterialIcons name="local-offer" size={16} color="#fff" />
                  <Text style={styles.statusButtonText}>Vendu</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={[styles.statusButton, styles.availableButton]}
                  onPress={handleMarkAsAvailable}
                >
                  <MaterialIcons name="refresh" size={16} color="#fff" />
                  <Text style={styles.statusButtonText}>En stock</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginVertical: 8,
    marginHorizontal: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  touchable: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    padding: 12,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 4,
    marginRight: 12,
  },
  info: {
    flex: 1,
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2196F3',
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginTop: 8,
    gap: 6,
  },
  soldButton: {
    backgroundColor: '#F44336',
  },
  availableButton: {
    backgroundColor: '#4CAF50',
  },
  statusButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default ItemCard; 