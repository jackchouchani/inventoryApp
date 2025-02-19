import React, { useState, useCallback, useMemo, memo, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Image } from 'react-native';
import { Item } from '../types/item';
import { Container } from '../types/container';
import { Category } from '../types/category';
import { ItemEditForm } from './ItemEditForm';
import { MaterialIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { selectAllCategories } from '../store/categorySlice';
import { selectAllContainers } from '../store/containersSlice';
import { useAnimatedComponents } from '../hooks/useAnimatedComponents';
import ItemCard from './ItemCard';
import { Skeleton } from './Skeleton';
import { withPerformanceMonitoring } from '../hoc/withPerformanceMonitoring';
import { monitoring } from '../services/monitoring';
import { photoService } from '../services/photoService';

interface ItemListProps {
  items: Item[];
  onItemPress?: (item: Item) => void;
  onMarkAsSold?: (item: Item) => void;
  onMarkAsAvailable?: (item: Item) => void;
  categories: Category[];
  containers: Container[];
  isLoading?: boolean;
  error?: string;
  selectedItem: Item | null;
  onEditSuccess: () => void;
  onEditCancel: () => void;
}

interface Filters {
  search: string;
  categoryId: number | null;
  containerId: 'none' | number | null;
  status: 'all' | 'available' | 'sold';
  minPrice: string;
  maxPrice: string;
}

const ItemListModal: React.FC<{
  selectedItem: Item | null;
  onSuccess: () => void;
  onCancel: () => void;
}> = ({ selectedItem, onSuccess, onCancel }) => {
  const categories = useSelector(selectAllCategories);
  const containers = useSelector(selectAllContainers);

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

const getStatusStyle = (status: 'available' | 'sold') => {
  switch (status) {
    case 'available':
      return styles.statusAvailable;
    case 'sold':
      return styles.statusSold;
    default:
      return styles.statusAvailable;
  }
};

const getStatusText = (status: 'available' | 'sold') => {
  switch (status) {
    case 'available':
      return 'Disponible';
    case 'sold':
      return 'Vendu';
    default:
      return 'Disponible';
  }
};

const ItemListItem = memo(({ item, onPress, categories, containers }: {
  item: Item;
  onPress?: (item: Item) => void;
  categories: Category[];
  containers: Container[];
}) => {
  const [imageUrl, setImageUrl] = useState<string | undefined>(item.photo_storage_url);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (item.photo_storage_url && item.photo_storage_url.includes('/images/')) {
      const filename = item.photo_storage_url.split('/images/').pop();
      if (filename) {
        setImageError(false);
        photoService.getImageUrlWithCache(filename) 
          .then(url => {
            console.log(`URL signée générée pour l'item ${item.id}:`, url);
            setImageUrl(url);
          })
          .catch(error => {
            console.error(`Erreur lors de la génération de l'URL signée pour l'item ${item.id}:`, error);
            setImageError(true);
          });
      }
    }
  }, [item.photo_storage_url, item.id]);

  return (
    <TouchableOpacity 
      style={styles.itemCard}
      onPress={() => onPress?.(item)}
    >
      <View style={styles.itemContent}>
        {imageUrl && !imageError ? (
          <Image 
            source={{ uri: imageUrl }} 
            style={styles.itemImage}
            resizeMode="cover"
            onError={(error) => {
              console.error(`Erreur de chargement de l'image pour l'item ${item.id}:`, error.nativeEvent.error);
              setImageError(true);
            }}
            onLoad={() => {
              console.log(`Image chargée avec succès pour l'item ${item.id}`);
              setImageError(false);
            }}
          />
        ) : (
          <View style={styles.noImagePlaceholder}>
            <MaterialIcons 
              name={imageError ? "broken-image" : "image-not-supported"} 
              size={24} 
              color="#ccc" 
            />
          </View>
        )}
        <View style={styles.itemDetailsContainer}>
          <Text style={styles.itemNameText}>{item.name}</Text>
          <Text style={styles.itemPriceText}>{item.sellingPrice}€</Text>
          <View style={styles.itemMetadata}>
            <Text style={styles.itemCategory}>
              {categories.find((c: Category) => c.id === item.categoryId)?.name || 'Sans catégorie'}
            </Text>
            {item.containerId && (
              <Text style={styles.itemContainer}>
                📦 {containers.find((c: Container) => c.id === item.containerId)?.name || 'Container inconnu'}
              </Text>
            )}
          </View>
          <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const ItemList: React.FC<ItemListProps> = memo(({
  items,
  onItemPress,
  onMarkAsSold,
  onMarkAsAvailable,
  categories,
  containers,
  isLoading,
  error,
  selectedItem,
  onEditSuccess,
  onEditCancel
}) => {
  const {
    opacity,
    fadeIn,
    fadeOut,
    fadeStyle,
    scale,
    scaleUp,
    scaleDown,
    scaleStyle
  } = useAnimatedComponents();

  const renderStartTime = useRef(Date.now());
  
  useEffect(() => {
    return () => {
      const renderDuration = Date.now() - renderStartTime.current;
      monitoring.recordMetric({
        type: 'RENDER',
        name: 'ItemList',
        duration: renderDuration,
        metadata: {
          itemCount: items.length,
          isLoading
        }
      });
    };
  });

  const renderItem = ({ item }: { item: Item }) => {
    console.log('Rendu de l\'item:', {
      id: item.id,
      name: item.name,
      photo_storage_url: item.photo_storage_url
    });
    
    return (
      <ItemListItem
        item={item}
        onPress={onItemPress}
        categories={categories}
        containers={containers}
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

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id?.toString() || ''}
      />

      <ItemListModal
        selectedItem={selectedItem}
        onSuccess={onEditSuccess}
        onCancel={onEditCancel}
      />
    </View>
  );
});

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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
});

ItemList.displayName = 'ItemList';
ItemRow.displayName = 'ItemRow';
ItemLoadingSkeleton.displayName = 'ItemLoadingSkeleton';

export default withPerformanceMonitoring(ItemList, 'ItemList');