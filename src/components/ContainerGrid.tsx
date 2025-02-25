import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions, RefreshControl } from 'react-native';
import { Container } from '../types/container';
import { Item } from '../types/item';
import { GridErrorBoundary } from './GridErrorBoundary';

interface ContainerGridProps {
  containers: Container[];
  items: Item[];
  onContainerPress: (containerId: number) => void;
  onRetry?: () => void;
}

const ContainerCard = React.memo(({ 
  container, 
  itemCount, 
  onPress 
}: { 
  container: Container; 
  itemCount: number; 
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={styles.containerCard}
    onPress={onPress}
  >
    <Text style={styles.containerName} numberOfLines={2}>
      {container.name}
    </Text>
    <Text style={styles.containerNumber}>#{container.number}</Text>
    <View style={styles.statsContainer}>
      <Text style={styles.itemCount}>
        {itemCount} article{itemCount > 1 ? 's' : ''}
      </Text>
    </View>
  </TouchableOpacity>
));

export const ContainerGrid: React.FC<ContainerGridProps> = ({
  containers,
  items,
  onContainerPress,
  onRetry,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);

  useEffect(() => {
    setForceUpdate(prev => prev + 1);
  }, [containers.length]);

  const onRefresh = useCallback(async () => {
    if (onRetry) {
      setRefreshing(true);
      try {
        await onRetry();
        setForceUpdate(prev => prev + 1);
      } finally {
        setRefreshing(false);
      }
    }
  }, [onRetry]);

  const itemCountMap = useMemo(() => {
    return items.reduce((acc, item) => {
      if (item.containerId) {
        acc[item.containerId] = (acc[item.containerId] || 0) + 1;
      }
      return acc;
    }, {} as Record<number, number>);
  }, [items]);

  const getItemCount = useCallback((containerId: number) => {
    return itemCountMap[containerId] || 0;
  }, [itemCountMap]);

  const renderItem = useCallback(({ item: container }: { item: Container }) => {
    const itemCount = getItemCount(container.id);
    return (
      <ContainerCard
        container={container}
        itemCount={itemCount}
        onPress={() => container.id && onContainerPress(container.id)}
      />
    );
  }, [getItemCount, onContainerPress]);

  const keyExtractor = useCallback((item: Container) => 
    `container-${item.id}`, []);

  const gridContent = (
    <FlatList
      data={containers}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={2}
      contentContainerStyle={styles.grid}
      columnWrapperStyle={styles.row}
      initialNumToRender={8}
      maxToRenderPerBatch={4}
      windowSize={5}
      removeClippedSubviews={true}
      extraData={[containers.length, forceUpdate]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#007AFF']}
          tintColor={'#007AFF'}
        />
      }
    />
  );

  return (
    <GridErrorBoundary
      gridName="grille des conteneurs"
      onRetry={onRetry}
    >
      {gridContent}
    </GridErrorBoundary>
  );
};

const { width } = Dimensions.get('window');
const CARD_MARGIN = 8;
const CARD_WIDTH = (width - (CARD_MARGIN * 6)) / 2;

const styles = StyleSheet.create({
  grid: {
    padding: CARD_MARGIN,
    flexGrow: 1,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: CARD_MARGIN,
  },
  containerCard: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: CARD_MARGIN,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 120,
    justifyContent: 'space-between',
    borderColor: '#E5E5E5',
    borderWidth: 1,
  },
  containerName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
  },
  containerNumber: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  itemCount: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
});