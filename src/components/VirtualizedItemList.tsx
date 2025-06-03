import React, { useCallback, memo, useMemo } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Item } from '../types/item';
import { Container } from '../types/container';
import { Category } from '../types/category';
import { Skeleton } from './Skeleton';
import { ErrorBoundary } from '../components/ErrorBoundary';
import ItemCard from './ItemCard';
import { useAppTheme } from '../contexts/ThemeContext';
import StyleFactory from '../styles/StyleFactory';

interface VirtualizedItemListProps {
  items: Item[];
  onItemPress?: (item: Item) => void;
  onMarkAsSold?: (item: Item) => void;
  onMarkAsAvailable?: (item: Item) => void;
  categories: Category[];
  containers: Container[];
  isLoading?: boolean;
  onEndReached?: () => void;
  isLoadingMore?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  estimatedItemSize?: number;
  windowSize?: number;
}

// Composant de skeleton optimisé pour la virtualisation
const ItemLoadingSkeleton = memo(() => {
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemList');
  
  return (
    <View style={styles.loadingContainer}>
      {Array.from({ length: 5 }).map((_, index) => (
        <View key={index} style={[styles.container, { height: 120, margin: 12 }]}>
          <Skeleton style={{ width: 80, height: 80, borderRadius: 8, marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Skeleton style={{ width: '60%', height: 16, marginBottom: 8 }} />
            <Skeleton style={{ width: '80%', height: 12, marginBottom: 8 }} />
            <Skeleton style={{ width: '40%', height: 12 }} />
          </View>
        </View>
      ))}
    </View>
  );
});

// Composant d'item optimisé pour FlashList
const VirtualizedItemComponent: React.FC<{ 
  item: Item; 
  categories: Category[]; 
  containers: Container[]; 
  onItemPress?: (item: Item) => void;
  onMarkAsSold?: (item: Item) => void; 
  onMarkAsAvailable?: (item: Item) => void;
  index: number;
}> = memo(({ 
  item, 
  onItemPress,
  onMarkAsSold,
  onMarkAsAvailable,
}) => {
  const handleItemPress = useCallback(() => {
    if (onItemPress) onItemPress(item);
  }, [item, onItemPress]);

  const handleMarkAsSold = useCallback(() => {
    if (onMarkAsSold) onMarkAsSold(item);
  }, [item, onMarkAsSold]);

  const handleMarkAsAvailable = useCallback(() => {
    if (onMarkAsAvailable) onMarkAsAvailable(item);
  }, [item, onMarkAsAvailable]);

  return (
    <ItemCard
      item={item}
      onPress={handleItemPress}
      onMarkAsSold={handleMarkAsSold}
      onMarkAsAvailable={handleMarkAsAvailable}
    />
  );
}, (prevProps, nextProps) => {
  // Comparaison optimisée pour éviter les re-renders inutiles
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.updatedAt === nextProps.item.updatedAt &&
    prevProps.item.status === nextProps.item.status &&
    prevProps.item.photo_storage_url === nextProps.item.photo_storage_url
  );
});

// Composant principal virtualisé
const VirtualizedItemList: React.FC<VirtualizedItemListProps> = ({
  items,
  onItemPress,
  onMarkAsSold,
  onMarkAsAvailable,
  categories,
  containers,
  isLoading = false,
  onEndReached,
  isLoadingMore = false,
  refreshing = false,
  onRefresh,
  estimatedItemSize = 120,
}) => {
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemList');
  const insets = useSafeAreaInsets();

  // Fonction de rendu optimisée
  const renderItem = useCallback(({ item, index }: { item: Item; index: number }) => {
    return (
      <VirtualizedItemComponent
        item={item}
        categories={categories}
        containers={containers}
        onItemPress={onItemPress}
        onMarkAsSold={onMarkAsSold}
        onMarkAsAvailable={onMarkAsAvailable}
        index={index}
      />
    );
  }, [categories, containers, onItemPress, onMarkAsSold, onMarkAsAvailable]);

  // Fonction pour déterminer le type d'item (optimisation FlashList)
  const getItemType = useCallback((item: Item) => {
    return item.status; // 'available' ou 'sold'
  }, []);

  // Key extractor optimisé
  const keyExtractor = useCallback((item: Item, index: number) => {
    return `${item.id}-${item.updatedAt}-${index}`;
  }, []);

  // Composant footer pour le chargement
  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;
    
    return (
      <View style={styles.loadingMoreContainer}>
        <ActivityIndicator size="small" color={activeTheme.primary} />
        <Text style={styles.loadingMoreText}>Chargement...</Text>
      </View>
    );
  }, [isLoadingMore, styles, activeTheme.primary]);

  // Composant pour la liste vide
  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Aucun article trouvé</Text>
      </View>
    );
  }, [isLoading, styles]);

  // Handler pour la fin de scroll optimisé
  const handleEndReached = useCallback(() => {
    if (onEndReached && !isLoadingMore) {
      onEndReached();
    }
  }, [onEndReached, isLoadingMore]);

  // Configuration des données mémoïsée
  const listData = useMemo(() => items, [items]);

  // Style du container avec hauteur réduite pour éviter l'overlap avec tab bar
  const containerStyle = useMemo(() => {
    let tabBarHeight;
    if (Platform.OS === 'web') {
      tabBarHeight = 80;
    } else {
      tabBarHeight = Platform.OS === 'ios' ? 65 + insets.bottom + 20 : 65;
    }
    
    return [
      styles.container,
      {
        marginBottom: tabBarHeight, // Réduire la hauteur du container
      }
    ];
  }, [styles.container, insets.bottom]);

  // Style du contenu - padding réduit maintenant
  const contentContainerStyle = useMemo(() => ({
    paddingBottom: 20, // Juste un petit padding
  }), []);

  if (isLoading && items.length === 0) {
    return <ItemLoadingSkeleton />;
  }

  return (
    <View style={containerStyle}>
      <FlashList
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        estimatedItemSize={estimatedItemSize}
        // Style avec padding réduit
        contentContainerStyle={contentContainerStyle}
        // Optimisations de performance
        removeClippedSubviews={true}
        // Pull-to-refresh
        refreshing={refreshing}
        onRefresh={onRefresh}
        // Pagination
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        // Composants personnalisés
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        // Optimisation des contenus
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={true}
      />
    </View>
  );
};

// Wrapper avec Error Boundary
const VirtualizedItemListWithErrorBoundary: React.FC<VirtualizedItemListProps> = (props) => {
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemList');
  
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Une erreur est survenue lors du chargement des articles.
          </Text>
          <Text style={styles.errorDetails}>{error.message}</Text>
        </View>
      )}
    >
      <VirtualizedItemList {...props} />
    </ErrorBoundary>
  );
};

export default VirtualizedItemListWithErrorBoundary; 