import React, { useCallback, memo, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Item } from '../types/item';
import { Container } from '../types/container';
import { Category } from '../types/category';
import { ItemEditForm } from './ItemEditForm';
import { Icon } from '../../src/components'; 
import { useSelector } from 'react-redux';
import { selectAllCategories } from '../store/categorySlice';
import { selectAllContainers } from '../store/containersSlice';
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
  selectedItem: Item | null;
  onEditSuccess: () => void;
  onEditCancel: () => void;
  onEndReached?: () => void;
  isLoadingMore?: boolean;
}

const ItemListModal: React.FC<{
  selectedItem: Item | null;
  onSuccess: () => void;
  onCancel: () => void;
  categories: Category[];
  containers: Container[];
}> = ({ selectedItem, onSuccess, onCancel, categories: propCategories, containers: propContainers }) => {
  const { activeTheme } = useAppTheme();
  const styles = useMemo(() => getThemedStyles(activeTheme), [activeTheme]);
  // Récupérer les catégories et containers depuis le store Redux
  const storeCategories = useSelector(selectAllCategories);
  const storeContainers = useSelector(selectAllContainers);
  
  // Utiliser les catégories et containers des props si disponibles, sinon utiliser ceux du store
  const categories = Array.isArray(propCategories) && propCategories.length > 0 
    ? propCategories 
    : Array.isArray(storeCategories) ? storeCategories : [];
  
  const containers = Array.isArray(propContainers) && propContainers.length > 0 
    ? propContainers 
    : Array.isArray(storeContainers) ? storeContainers : [];
  
  return (
    <Modal
      visible={!!selectedItem}
      animationType="slide"
      transparent={true}
      onRequestClose={onCancel}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Modifier l'article</Text>
            <TouchableOpacity style={styles.modalCloseButton} onPress={onCancel}>
            <Icon name="close" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>
          {selectedItem && (
            <ItemEditForm
              item={selectedItem}
              containers={containers}
              categories={categories}
              onSuccess={onSuccess}
              onCancel={onCancel}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const ItemRow = memo(({ 
  item, 
  onMarkAsSold, 
  onMarkAsAvailable,
  onPress
}: { 
  item: Item; 
  onMarkAsSold?: (id: number) => void;
  onMarkAsAvailable?: (id: number) => void;
  onPress?: () => void;
}) => {
  const { activeTheme } = useAppTheme();
  const styles = useMemo(() => getThemedStyles(activeTheme), [activeTheme]);
  const handleMarkAsSold = () => {
    if (onMarkAsSold) onMarkAsSold(item.id);
  };

  const handleMarkAsAvailable = () => {
    if (onMarkAsAvailable) onMarkAsAvailable(item.id);
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.itemRow}>
      <View style={styles.itemInfo}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={[
            styles.itemStatus,
            item.status === 'sold' ? styles.soldStatus : styles.availableStatus
          ]}>
            {item.status === 'sold' ? 'Vendu' : 'Disponible'}
          </Text>
        </View>
        <View style={styles.itemDetails}>
          <Text style={styles.itemDescription}>{item.description}</Text>
          <Text style={styles.itemPrice}>{item.sellingPrice}€</Text>
        </View>
      </View>
      <View style={styles.itemActions}>
        {item.status === 'available' ? (
          <TouchableOpacity onPress={handleMarkAsSold} style={styles.actionButton}>
            <Icon name="shopping_cart" size={20} color="#fff" />
            <Text style={styles.buttonText}>Vendu</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleMarkAsAvailable} style={[styles.actionButton, styles.restoreButton]}>
            <Icon name="restore" size={20} color="#fff" />
            <Text style={styles.buttonText}>En stock</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
});

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
  onPress?: (item: Item) => void; 
  categories: Category[]; 
  containers: Container[]; 
  onMarkAsSold?: (item: Item) => void; 
  onMarkAsAvailable?: (item: Item) => void; 
}> = ({ 
  item, 
  onPress,
  onMarkAsSold,
  onMarkAsAvailable 
}) => {
  const handlePress = useCallback(() => {
    onPress?.(item);
  }, [item, onPress]);

  const handleMarkAsSold = useCallback(() => {
    if (onMarkAsSold) onMarkAsSold(item);
  }, [item, onMarkAsSold]);

  const handleMarkAsAvailable = useCallback(() => {
    if (onMarkAsAvailable) onMarkAsAvailable(item);
  }, [item, onMarkAsAvailable]);

  return (
    <ItemCard
      item={item}
      onPress={handlePress}
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
  selectedItem,
  onEditSuccess,
  onEditCancel,
  onEndReached,
  isLoadingMore
}) => {
  const { activeTheme } = useAppTheme();
  const styles = useMemo(() => getThemedStyles(activeTheme), [activeTheme]);
  const renderItem = ({ item }: { item: Item }) => {
    
    return (
      <ItemListItem
        item={item}
        onPress={onItemPress}
        categories={categories}
        containers={containers}
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

      <ItemListModal
        selectedItem={selectedItem}
        onSuccess={onEditSuccess}
        onCancel={onEditCancel}
        categories={categories}
        containers={containers}
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
  searchBar: {
    flexDirection: 'row',
    padding: 10,
    gap: 10,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 5,
    paddingHorizontal: 10,
  },
  filterButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 5,
  },
  filtersContainer: {
    padding: 10,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    maxHeight: '50%',
  },
  filterSection: {
    marginBottom: 15,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: theme.text.primary,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    boxShadow: theme.shadows.sm.boxShadow,
    elevation: theme.shadows.sm.elevation,
  },
  filterOptionSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  filterOptionText: {
    fontSize: 12,
    color: theme.text.primary,
  },
  filterOptionTextSelected: {
    color: theme.text.inverse,
    fontWeight: 'bold',
  },
  priceInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priceInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 5,
    paddingHorizontal: 10,
    backgroundColor: theme.surface,
  },
  priceSeparator: {
    color: theme.text.secondary,
    fontSize: 16,
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
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    boxShadow: theme.shadows.md.boxShadow,
    elevation: theme.shadows.md.elevation,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalCloseButton: {
    padding: 8,
  },
  itemRow: {
    backgroundColor: theme.surface,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    boxShadow: theme.shadows.md.boxShadow,
    elevation: theme.shadows.md.elevation,
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
    color: theme.text.primary,
  },
  itemDescription: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.text.secondary,
    marginBottom: 4,
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemPrice: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
    color: theme.primary,
  },
  itemStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '500',
  },
  availableStatus: {
    backgroundColor: theme.success,
    color: theme.text.primary,
  },
  soldStatus: {
    backgroundColor: theme.danger.background,
    color: theme.danger.text,
  },
  itemActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    boxShadow: theme.shadows.sm.boxShadow,
    elevation: theme.shadows.sm.elevation,
  },
  restoreButton: {
    backgroundColor: theme.warning,
  },
  buttonText: {
    color: theme.text.inverse,
    fontSize: theme.typography.caption.fontSize,
    fontWeight: '500',
    marginLeft: 8,
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
  itemCard: {
    backgroundColor: theme.surface,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    boxShadow: theme.shadows.md.boxShadow,
    elevation: theme.shadows.md.elevation,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  noImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.sm,
    marginRight: 12,
    backgroundColor: theme.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  itemDetailsContainer: {
    flex: 1,
  },
  itemMetadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.text.secondary,
  },
  itemContainer: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.text.secondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusAvailable: {
    backgroundColor: theme.success,
  },
  statusSold: {
    backgroundColor: theme.danger.background,
  },
  itemNameText: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
    color: theme.text.primary,
    marginBottom: 4,
  },
  itemPriceText: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.primary,
    fontWeight: '600',
    marginBottom: 4,
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
  retryButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
    marginTop: 16,
  },
  retryButtonText: {
    color: theme.text.inverse,
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
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
ItemRow.displayName = 'ItemRow';
ItemLoadingSkeleton.displayName = 'ItemLoadingSkeleton';

export default ItemListWithErrorBoundary;