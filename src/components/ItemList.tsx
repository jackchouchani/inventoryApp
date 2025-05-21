import React, { useCallback, memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Item } from '../types/item';
import { Container } from '../types/container';
import { Category } from '../types/category';
import { ItemEditForm } from './ItemEditForm';
import { MaterialIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { selectAllCategories } from '../store/categorySlice';
import { selectAllContainers } from '../store/containersSlice';
import { Skeleton } from './Skeleton';
import { ErrorBoundary } from '../components/ErrorBoundary';
import ItemCard from './ItemCard';

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
              <MaterialIcons name="close" size={24} color="#007AFF" />
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
            <MaterialIcons name="shopping-cart" size={20} color="#fff" />
            <Text style={styles.buttonText}>Vendu</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleMarkAsAvailable} style={[styles.actionButton, styles.restoreButton]}>
            <MaterialIcons name="restore" size={20} color="#fff" />
            <Text style={styles.buttonText}>En stock</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
});

const ItemLoadingSkeleton = memo(() => (
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
));

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
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.loadingMoreText}>Chargement d'articles supplémentaires...</Text>
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

const ItemListWithErrorBoundary = (props: ItemListProps) => (
  <ErrorBoundary
    fallbackRender={({ error }) => (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Une erreur est survenue lors du chargement de la liste</Text>
        <Text style={styles.errorDetails}>{error.message}</Text>
      </View>
    )}
  >
    <ItemList {...props} />
  </ErrorBoundary>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchBar: {
    flexDirection: 'row',
    padding: 10,
    gap: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
  },
  filterButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
  },
  filtersContainer: {
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    maxHeight: '50%',
  },
  filterSection: {
    marginBottom: 15,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
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
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  filterOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterOptionText: {
    fontSize: 12,
    color: '#333',
  },
  filterOptionTextSelected: {
    color: '#fff',
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
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  priceSeparator: {
    color: '#666',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
    padding: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    padding: 8,
  },
  itemRow: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
  },
  itemStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '500',
  },
  availableStatus: {
    backgroundColor: '#E8F5E9',
    color: '#2E7D32',
  },
  soldStatus: {
    backgroundColor: '#FFEBEE',
    color: '#C62828',
  },
  itemActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    boxShadow: '0px 2px 2px rgba(0, 0, 0, 0.1)',
    elevation: 1,
  },
  restoreButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  skeletonContainer: {
    padding: 12,
  },
  skeletonRow: {
    height: 120,
    backgroundColor: '#fff',
    marginVertical: 6,
    borderRadius: 12,
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
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
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
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
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
    fontSize: 12,
    color: '#666',
  },
  itemContainer: {
    fontSize: 12,
    color: '#666',
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
    backgroundColor: '#e6f4ea',
  },
  statusSold: {
    backgroundColor: '#fce8e6',
  },
  itemNameText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemPriceText: {
    fontSize: 14,
    color: '#2196f3',
    fontWeight: '600',
    marginBottom: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#e53935',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDetails: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  loadingMoreText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
  },
});

ItemList.displayName = 'ItemList';
ItemRow.displayName = 'ItemRow';
ItemLoadingSkeleton.displayName = 'ItemLoadingSkeleton';

export default ItemListWithErrorBoundary;