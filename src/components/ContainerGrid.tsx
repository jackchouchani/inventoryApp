import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions, RefreshControl } from 'react-native';
import { Container } from '../types/container';
import { Item } from '../types/item';
import { GridErrorBoundary } from './GridErrorBoundary';
import { useAppTheme } from '../contexts/ThemeContext';

interface ContainerGridProps {
  containers: Container[];
  items: Item[];
  onContainerPress: (containerId: number) => void;
  onRetry?: () => void;
}

const ContainerCard = React.memo(({ 
  container, 
  itemCount, 
  onPress,
  activeTheme
}: { 
  container: Container; 
  itemCount: number; 
  onPress: () => void;
  activeTheme: any;
}) => {
  const styles = useMemo(() => getThemedStyles(activeTheme), [activeTheme]);
  
  return (
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
  );
});

export const ContainerGrid: React.FC<ContainerGridProps> = ({
  containers,
  items,
  onContainerPress,
  onRetry,
}) => {
  const { activeTheme } = useAppTheme();
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
        activeTheme={activeTheme}
      />
    );
  }, [getItemCount, onContainerPress, activeTheme]);

  const keyExtractor = useCallback((item: Container) => 
    `container-${item.id}`, []);

  const gridContent = (
    <FlatList
      data={containers}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={2}
      contentContainerStyle={getThemedStyles(activeTheme).grid}
      columnWrapperStyle={getThemedStyles(activeTheme).row}
      initialNumToRender={8}
      maxToRenderPerBatch={4}
      windowSize={5}
      removeClippedSubviews={true}
      extraData={[containers.length, forceUpdate]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[activeTheme.primary]}
          tintColor={activeTheme.primary}
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

const getThemedStyles = (theme: any) => StyleSheet.create({
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
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    margin: CARD_MARGIN,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
    minHeight: 120,
    justifyContent: 'space-between',
    borderColor: theme.border,
    borderWidth: 1,
  },
  containerName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: theme.text.primary,
  },
  containerNumber: {
    fontSize: 14,
    color: theme.text.secondary,
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
    color: theme.primary,
    fontWeight: '600',
  },
});