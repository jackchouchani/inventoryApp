import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { Icon } from './Icon';
import { useAppTheme } from '../contexts/ThemeContext';
import ItemCard from './ItemCard';
import { useInventoryData } from '../hooks/useInventoryData';
import type { Item } from '../types/item';
import type { Container } from '../types/container';

interface ContainerContentsProps {
  container: Container;
  onItemPress: (item: Item) => void;
}

export const ContainerContents: React.FC<ContainerContentsProps> = ({
  container,
  onItemPress,
}) => {
  const { activeTheme } = useAppTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Utiliser le hook d'inventaire avec filtre par container
  const {
    data: inventoryData,
    isLoading,
    error,
    refetch,
  } = useInventoryData({
    containerId: container.id,
  });

  const items = inventoryData?.items || [];
  const hasMore = false; // Pas de pagination pour l'instant
  const totalCount = items.length;

  const handleRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      await refetch();
    } catch (err) {
      console.error('Erreur lors du rafraîchissement:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const emptyComponent = useMemo(() => (
    <View style={styles.emptyContainer}>
      <Icon name="inventory" size={48} color={activeTheme.text.secondary} />
      <Text style={[styles.emptyText, { color: activeTheme.text.primary }]}>
        Aucun article dans ce conteneur
      </Text>
    </View>
  ), [activeTheme.text.primary, activeTheme.text.secondary]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={[styles.errorText, { color: activeTheme.error }]}>
          {error}
        </Text>
      </View>
    );
  }

  const renderItem = useCallback(({ item }: { item: Item }) => (
    <ItemCard
      item={item}
      onPress={() => onItemPress(item)}
    />
  ), [onItemPress]);

  return (
    <View style={[styles.container, { backgroundColor: activeTheme.background }]}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={emptyComponent}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[activeTheme.primary]}
          />
        }
      />
      
      {hasMore && (
        <View style={styles.loadMoreContainer}>
          <ActivityIndicator 
            size="small" 
            color={activeTheme.primary}
          />
        </View>
      )}
      
      {totalCount > 0 && (
        <View style={[styles.paginationInfo, { backgroundColor: activeTheme.surface }]}>
          <Text style={[styles.paginationText, { color: activeTheme.text.primary }]}>
            {totalCount} article{totalCount > 1 ? 's' : ''} dans ce conteneur
          </Text>
        </View>
      )}
    </View>
  );
};

ContainerContents.displayName = 'ContainerContents';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  paginationInfo: {
    padding: 10,
    borderTopWidth: 1,
  },
  paginationText: {
    textAlign: 'center',
  },
  loadMoreContainer: {
    padding: 10,
    alignItems: 'center',
  },
  listContent: {
    flexGrow: 1,
  },
}); 