import React, { useMemo, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from './Icon';
import { getImageUrl } from '../utils/r2Client';
import { formatCurrency } from '../utils/format';
import { useSimilarItems } from '../hooks/useSimilarItems';
import { useAppTheme, type AppThemeType } from '../contexts/ThemeContext';
import type { Item } from '../types/item';

interface SimilarItemsProps {
  itemId: number | string;
  maxRecommendations?: number;
  title?: string;
}

export const SimilarItems: React.FC<SimilarItemsProps> = ({ 
  itemId, 
  maxRecommendations = 3, 
  title = "Articles similaires" 
}) => {
  const router = useRouter();
  const { activeTheme } = useAppTheme();
  const { similarItems, isLoading, error } = useSimilarItems(itemId, maxRecommendations);
  
  const styles = useMemo(() => getThemedStyles(activeTheme), [activeTheme]);

  const handleSimilarItemPress = useCallback((item: Item) => {
    console.log('Navigation vers l\'article similaire:', item.id);
    router.push(`/item/${item.id}/info`);
  }, [router]);

  const renderSimilarItem = useCallback(({ item }: { item: Item }) => {
    const imageUri = item.photo_storage_url 
      ? getImageUrl(item.photo_storage_url) 
      : process.env.EXPO_PUBLIC_FALLBACK_IMAGE_URL;

    return (
      <TouchableOpacity 
        style={styles.similarItemContainer} 
        onPress={() => handleSimilarItemPress(item)}
      >
        <View style={styles.imageContainer}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.similarItemImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.noImageContainer}>
              <Icon name="image_not_supported" size={32} color={activeTheme.text.disabled} />
            </View>
          )}
        </View>
        
        <View style={styles.itemInfo}>
          <Text style={styles.similarItemName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.similarItemPrice}>
            {formatCurrency(item.sellingPrice)}
          </Text>
          <View style={[
            styles.statusBadge,
            item.status === 'available' ? styles.availableStatus : styles.soldStatus
          ]}>
            <Text style={[
              styles.statusText,
              item.status === 'available' ? styles.availableStatusText : styles.soldStatusText
            ]}>
              {item.status === 'available' ? 'Disponible' : 'Vendu'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [handleSimilarItemPress, styles, activeTheme]);

  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={activeTheme.primary} />
          <Text style={styles.loadingText}>Recherche d'articles similaires...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.errorContainer}>
          <Icon name="error_outline" size={24} color={activeTheme.error} />
          <Text style={styles.errorText}>Impossible de charger les articles similaires</Text>
        </View>
      </View>
    );
  }

  if (!similarItems || similarItems.length === 0) {
    return null; // Ne pas afficher la section s'il n'y a pas d'articles similaires
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <FlatList
        horizontal
        data={similarItems}
        renderItem={renderSimilarItem}
        keyExtractor={(item) => item.id.toString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.similarItemsList}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
      />
    </View>
  );
};

const getThemedStyles = (theme: AppThemeType) => StyleSheet.create({
  section: {
    marginTop: 20,
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: theme.text.primary,
  },
  similarItemsList: {
    paddingBottom: 8,
  },
  itemSeparator: {
    width: 12,
  },
  similarItemContainer: {
    width: 140,
    backgroundColor: theme.background,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  imageContainer: {
    height: 100,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: theme.backgroundSecondary,
  },
  similarItemImage: {
    width: '100%',
    height: '100%',
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
  },
  itemInfo: {
    flex: 1,
  },
  similarItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.text.primary,
    marginBottom: 4,
    lineHeight: 18,
  },
  similarItemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.primary,
    marginBottom: 6,
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  availableStatus: {
    backgroundColor: theme.successLight,
  },
  soldStatus: {
    backgroundColor: theme.danger.light,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  availableStatusText: {
    color: theme.success,
  },
  soldStatusText: {
    color: theme.danger.main,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    color: theme.text.secondary,
    marginLeft: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 14,
    color: theme.error,
    marginLeft: 8,
  },
});

export default SimilarItems; 