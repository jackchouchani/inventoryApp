import React, { useCallback, memo, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Item } from '../types/item';
import { Container } from '../types/container';
import { Category } from '../types/category';
import { Skeleton } from './Skeleton';
import { ErrorBoundary } from '../components/ErrorBoundary';
import ItemCard from './ItemCard';
import { useAppTheme, type AppThemeType } from '../contexts/ThemeContext';

interface ItemListProps {
  items: Item[];
  onItemPress?: (item: Item) => void;
  onMarkAsSold?: (item: Item) => void;
  onMarkAsAvailable?: (item: Item) => void;
  categories: Category[];
  containers: Container[];
  isLoading?: boolean;
  onEndReached?: () => void;
  isLoadingMore?: boolean;
}

const ItemLoadingSkeleton = memo(() => {
  const { activeTheme } = useAppTheme();
  const styles = useMemo(() => getThemedStyles(activeTheme), [activeTheme]);
  
  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: 5 }).map((_, index) => (
        <View key={index} style={styles.skeletonRow}>
          <Skeleton style={styles.skeletonName} />
          <Skeleton style={styles.skeletonPrice} />
          <Skeleton style={styles.skeletonStatus} />
          <Skeleton style={styles.skeletonButton} />
        </View>
      ))}
    </View>
  );
});

const ItemListItemComponent: React.FC<{ 
  item: Item; 
  categories: Category[]; 
  containers: Container[]; 
  onItemPress?: (item: Item) => void;
  onMarkAsSold?: (item: Item) => void; 
  onMarkAsAvailable?: (item: Item) => void; 
}> = ({ 
  item, 
  onItemPress,
  onMarkAsSold,
  onMarkAsAvailable 
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
};

const ItemListItem = memo(ItemListItemComponent, (prevProps, nextProps) => {
  return (
    prevProps.item.photo_storage_url === nextProps.item.photo_storage_url &&
    prevProps.item.updatedAt === nextProps.item.updatedAt
  );
});

const ItemList: React.FC<ItemListProps> = ({
  items,
  onItemPress,
  onMarkAsSold,
  onMarkAsAvailable,
  categories,
  containers,
  isLoading,
  onEndReached,
  isLoadingMore
}) => {
  const { activeTheme } = useAppTheme();
  const styles = useMemo(() => getThemedStyles(activeTheme), [activeTheme]);
  
  const renderItem = ({ item }: { item: Item }) => {
    return (
      <ItemListItem
        item={item}
        categories={categories}
        containers={containers}
        onItemPress={onItemPress}
        onMarkAsSold={onMarkAsSold}
        onMarkAsAvailable={onMarkAsAvailable}
      />
    );
  };

  if (isLoading) {
    return <ItemLoadingSkeleton />;
  }

  if (!items.length) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Aucun article trouvé</Text>
      </View>
    );
  }

  // Composant pour l'indicateur de chargement en bas de liste
  const renderFooter = () => {
    if (!isLoadingMore) return null;
    
    return (
      <View style={styles.loadingMoreContainer}>
        <ActivityIndicator size="small" color={activeTheme.primary} />
        <Text style={styles.loadingMoreText}>Chargement...</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.id}-${item.updatedAt}`}
        initialNumToRender={5}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews={true}
        getItemLayout={(_data, index) => ({
          length: 120,
          offset: 120 * index,
          index,
        })}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
        }}
        onEndReachedThreshold={0.3}
        onEndReached={({ distanceFromEnd }) => {
          console.log(`[ItemList] End reached, distance from end: ${distanceFromEnd}`);
          if (onEndReached) onEndReached();
        }}
        ListFooterComponent={renderFooter()}
      />
    </View>
  );
};

const ItemListWithErrorBoundary: React.FC<ItemListProps> = (props) => {
  const { activeTheme } = useAppTheme();
  const styles = useMemo(() => getThemedStyles(activeTheme), [activeTheme]);
  
  return (
    <ErrorBoundary
    fallbackRender={({ error }) => (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Une erreur est survenue lors du chargement des articles.</Text>
          <Text style={styles.errorDetails}>{error.message}</Text>
        </View>
      )}
    >
      <ItemList {...props} />
    </ErrorBoundary>
  );
};

const getThemedStyles = (theme: AppThemeType) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.text.secondary,
  },
  skeletonContainer: {
    padding: 12,
  },
  skeletonRow: {
    height: 120,
    backgroundColor: theme.surface,
    marginVertical: 6,
    borderRadius: theme.borderRadius.md,
    padding: 16,
  },
  skeletonName: {
    width: '60%',
    height: 20,
    marginBottom: 8,
  },
  skeletonPrice: {
    width: '20%',
    height: 24,
  },
  skeletonStatus: {
    width: '30%',
    height: 24,
    marginLeft: 'auto',
  },
  skeletonButton: {
    width: '40%',
    height: 36,
    marginLeft: 'auto',
    marginTop: 12,
    borderRadius: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.background,
  },
  errorText: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.danger.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDetails: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.text.secondary,
    textAlign: 'center',
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  loadingMoreText: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.text.secondary,
    marginLeft: 10,
  },
});

ItemList.displayName = 'ItemList';
ItemLoadingSkeleton.displayName = 'ItemLoadingSkeleton';

export default ItemListWithErrorBoundary;