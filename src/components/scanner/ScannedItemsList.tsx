import React, { useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Platform, Alert } from 'react-native';
import { Icon } from '../Icon';
import { useAppTheme } from '../../contexts/ThemeContext';
import StyleFactory from '../../styles/StyleFactory';
import { ScannedItem } from '../../hooks/useScannerStateMachine';

interface ScannedItemsListProps {
  items: ScannedItem[];
  onRemoveItem: (itemId: number) => void;
  isProcessing?: boolean;
}

const ScannedItemCard: React.FC<{
  item: ScannedItem;
  onRemove: (itemId: number) => void;
  styles: any;
  isProcessing?: boolean;
}> = React.memo(({ item, onRemove, styles, isProcessing }) => {
  const handleRemove = useCallback(() => {
    if (isProcessing) return;

    const confirmRemoval = () => {
      onRemove(item.id!);
    };

    if (Platform.OS === 'web') {
      // Utiliser window.confirm sur le web
      const confirmed = window.confirm(`Êtes-vous sûr de vouloir retirer "${item.name}" de la liste?`);
      if (confirmed) {
        confirmRemoval();
      }
    } else {
      // Utiliser Alert.alert sur mobile
      Alert.alert(
        'Retirer l\'article',
        `Êtes-vous sûr de vouloir retirer "${item.name}" de la liste?`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Retirer', style: 'destructive', onPress: confirmRemoval }
        ]
      );
    }
  }, [item, onRemove, isProcessing]);

  const timeAgo = React.useMemo(() => {
    const seconds = Math.floor((Date.now() - item.scannedAt) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h`;
  }, [item.scannedAt]);

  return (
    <View style={[styles.scannedItem, {
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginVertical: 1,
      marginHorizontal: 6,
    }]}>
      <View style={[styles.scannedItemInfo, { marginRight: 8 }]}>
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 2
        }}>
          <Text style={[styles.scannedItemName, { 
            flex: 1,
            fontSize: 14,
            marginBottom: 0,
            marginRight: 8,
          }]} numberOfLines={1}>
            {item.name}
          </Text>
          {item.sellingPrice && (
            <Text style={[styles.scannedItemPrice, {
              fontSize: 13,
              marginBottom: 0,
              fontWeight: '600',
            }]}>
              {item.sellingPrice} €
            </Text>
          )}
        </View>
        
        <Text style={[styles.scannedItemTime, {
          fontSize: 11,
        }]}>
          {timeAgo}
        </Text>
      </View>
      
      <TouchableOpacity
        style={[
          styles.removeItemButton,
          {
            padding: 8,
            borderRadius: 8,
          },
          isProcessing && { opacity: 0.5 }
        ]}
        onPress={handleRemove}
        disabled={isProcessing}
        activeOpacity={0.7}
      >
        <Icon name="close" size={16} color="#FF3B30" />
      </TouchableOpacity>
    </View>
  );
});

const ItemSeparator = React.memo(({ styles }: { styles: any }) => (
  <View style={styles.itemSeparator} />
));

const EmptyState = React.memo(({ styles }: { styles: any }) => (
  <View style={styles.emptyState}>
    <Icon name="info" size={40} color="rgba(255,255,255,0.5)" style={styles.emptyStateIcon} />
    <Text style={styles.emptyStateText}>
      Scannez des articles pour les ajouter au container
    </Text>
  </View>
));

const ListHeader = React.memo(({ 
  itemCount, 
  styles 
}: { 
  itemCount: number; 
  styles: any; 
}) => (
  <View style={styles.listHeader}>
    <Icon name="format_list_bulleted" size={20} color="#fff" />
    <Text style={styles.listHeaderText}>
      {itemCount} article{itemCount > 1 ? 's' : ''} scanné{itemCount > 1 ? 's' : ''}
    </Text>
  </View>
));

export const ScannedItemsList: React.FC<ScannedItemsListProps> = React.memo(({
  items,
  onRemoveItem,
  isProcessing = false
}) => {
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'Scanner');

  const renderItem = useCallback(({ item }: { item: ScannedItem }) => (
    <ScannedItemCard
      item={item}
      onRemove={onRemoveItem}
      styles={styles}
      isProcessing={isProcessing}
    />
  ), [onRemoveItem, styles, isProcessing]);

  const keyExtractor = useCallback((item: ScannedItem, index: number) => {
    return `${item.id}-${item.scannedAt}-${index}`;
  }, []);

  const renderEmptyComponent = useCallback(() => (
    <EmptyState styles={styles} />
  ), [styles]);

  const renderSeparator = useCallback(() => (
    <ItemSeparator styles={styles} />
  ), [styles]);

  return (
    <View style={styles.scannedItemsContainer}>
      <ListHeader itemCount={items.length} styles={styles} />
      
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        style={styles.scannedItemsList}
        ItemSeparatorComponent={renderSeparator}
        ListEmptyComponent={renderEmptyComponent}
        scrollEnabled={true}
        showsVerticalScrollIndicator={true}
        bounces={Platform.OS === 'ios'}
        overScrollMode={Platform.OS === 'android' ? 'auto' : undefined}
        removeClippedSubviews={true}
        maxToRenderPerBatch={8}
        windowSize={8}
        initialNumToRender={5}
        getItemLayout={(data, index) => ({
          length: 54,
          offset: 54 * index,
          index,
        })}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 8,
        }}
      />
    </View>
  );
});

export default ScannedItemsList; 