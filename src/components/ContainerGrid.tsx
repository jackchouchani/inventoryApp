import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet, Dimensions, Platform } from 'react-native';
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

const { width } = Dimensions.get('window');

// Layout responsive selon la taille d'écran
const getResponsiveLayout = () => {
  let numColumns = 2; // Mobile par défaut
  let cardPadding = 12;
  let gridPadding = 16;
  
  if (width >= 1200) {
    // Desktop large
    numColumns = 5;
    cardPadding = 16;
    gridPadding = 24;
  } else if (width >= 900) {
    // Desktop/Tablet large
    numColumns = 4;
    cardPadding = 14;
    gridPadding = 20;
  } else if (width >= 600) {
    // Tablet
    numColumns = 3;
    cardPadding = 12;
    gridPadding = 16;
  }
  
  const cardMargin = 8;
  const availableWidth = width - (gridPadding * 2) - (cardMargin * (numColumns - 1));
  const cardWidth = availableWidth / numColumns;
  
  return {
    numColumns,
    cardWidth,
    cardPadding,
    gridPadding,
    cardMargin
  };
};

const ContainerCard = React.memo(({ 
  container, 
  itemCount, 
  onPress,
  activeTheme,
  layout
}: { 
  container: Container; 
  itemCount: number; 
  onPress: () => void;
  activeTheme: any;
  layout: any;
}) => {
  const styles = useMemo(() => getCardStyles(activeTheme, layout), [activeTheme, layout]);
  
  return (
    <TouchableOpacity
      style={styles.containerCard}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.containerName} numberOfLines={2}>
          {container.name}
        </Text>
        <Text style={styles.containerNumber}>#{container.number}</Text>
      </View>
      
      {container.description && (
        <Text style={styles.containerDescription} numberOfLines={2}>
          {container.description}
        </Text>
      )}
      
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
  const [layout, setLayout] = useState(getResponsiveLayout);

  // Recalculer le layout lors du changement de taille
  useEffect(() => {
    const handleResize = () => {
      setLayout(getResponsiveLayout());
    };
    
    // Écouter les changements de dimensions (Web seulement)
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const styles = useMemo(() => getGridStyles(activeTheme, layout), [activeTheme, layout]);

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
        layout={layout}
      />
    );
  }, [getItemCount, onContainerPress, activeTheme, layout]);

  const keyExtractor = useCallback((item: Container) => 
    `container-${item.id}`, []);

  const gridContent = (
    <FlatList
      data={containers}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={layout.numColumns}
      key={`${layout.numColumns}-${forceUpdate}`} // Force re-render quand numColumns change
      contentContainerStyle={styles.grid}
      columnWrapperStyle={layout.numColumns > 1 ? styles.gridRow : null}
      initialNumToRender={12}
      maxToRenderPerBatch={8}
      windowSize={5}
      removeClippedSubviews={true}
      extraData={[containers.length, forceUpdate, layout.numColumns]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[activeTheme.primary]}
          tintColor={activeTheme.primary}
        />
      }
      // Forcer les styles de scroll pour iOS Safari
      style={Platform.OS === 'web' ? { WebkitOverflowScrolling: 'touch' } : undefined}
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

const getGridStyles = (theme: any, layout: any) => StyleSheet.create({
  grid: {
    padding: layout.gridPadding,
    flexGrow: 1,
    // Pas de paddingBottom ici, on utilise marginBottom sur le container parent
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: layout.cardMargin,
  },
});

const getCardStyles = (theme: any, layout: any) => StyleSheet.create({
  containerCard: {
    width: layout.cardWidth,
    minHeight: 140,
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: layout.cardPadding,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: theme.border,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    marginBottom: 8,
  },
  containerName: {
    fontSize: layout.numColumns >= 4 ? 14 : 16,
    fontWeight: '700',
    marginBottom: 4,
    color: theme.text.primary,
    textAlign: 'left',
  },
  containerNumber: {
    fontSize: layout.numColumns >= 4 ? 12 : 14,
    color: theme.text.secondary,
    fontWeight: '500',
  },
  containerDescription: {
    fontSize: layout.numColumns >= 4 ? 11 : 12,
    color: theme.text.secondary,
    marginBottom: 8,
    lineHeight: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  itemCount: {
    fontSize: layout.numColumns >= 4 ? 12 : 14,
    color: theme.primary,
    fontWeight: '600',
  },
});