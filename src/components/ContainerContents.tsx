import React, { useState, useCallback } from 'react';
import { View, FlatList, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Item } from '../database/types';
import { useInventoryData } from '../hooks/useInventoryData';
import { ItemCard } from './ItemCard';

interface ContainerContentsProps {
  containerId: number;
}

export const ContainerContents: React.FC<ContainerContentsProps> = ({ containerId }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  const {
    items,
    isLoading,
    error,
    hasMore,
    totalCount,
    fetchNextPage
  } = useInventoryData({
    containerId,
    page: currentPage,
    pageSize: PAGE_SIZE
  });

  const handleLoadMore = useCallback(async () => {
    if (hasMore && !isLoading) {
      setCurrentPage(prev => prev + 1);
      await fetchNextPage();
    }
  }, [hasMore, isLoading, fetchNextPage]);

  const renderFooter = useCallback(() => {
    if (!hasMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  }, [hasMore]);

  const renderItem = useCallback(({ item }: { item: Item }) => (
    <ItemCard item={item} />
  ), []);

  const keyExtractor = useCallback((item: Item) => 
    item.id?.toString() || '', 
  []);

  const renderEmptyComponent = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>Aucun article dans ce container</Text>
    </View>
  ), []);

  if (isLoading && items.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error.message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmptyComponent}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
      />
      {totalCount > 0 && (
        <View style={styles.paginationInfo}>
          <Text style={styles.paginationText}>
            {`${items.length} sur ${totalCount} articles`}
          </Text>
        </View>
      )}
    </View>
  );
};

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
    color: '#FF3B30',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 16,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  paginationInfo: {
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  paginationText: {
    textAlign: 'center',
    color: '#8E8E93',
  },
}); 