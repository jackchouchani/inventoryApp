import React, { useState, useCallback, useMemo } from 'react';
import { View, FlatList, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Item } from '../types/item';
import { useInventoryData } from '../hooks/useInventoryData';
import ItemCard from './ItemCard';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useTheme } from '../hooks/useTheme';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { handleError, ErrorType } from '../utils/errorHandler';

const PAGE_SIZE = 25;

interface ContainerContentsProps {
  containerId: number;
  onItemPress?: (item: Item) => void;
  onRefresh?: () => Promise<void>;
}

export const ContainerContents: React.FC<ContainerContentsProps> = React.memo(({ 
  containerId,
  onItemPress,
  onRefresh 
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const theme = useTheme();
  const { isConnected } = useNetworkStatus();

  const {
    items,
    isLoading,
    error,
    hasMore,
    totalCount,
    fetchNextPage,
    refetch
  } = useInventoryData({
    containerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
    enabled: isConnected
  });

  const handleLoadMore = useCallback(async () => {
    try {
      if (hasMore && !isLoading) {
        setCurrentPage(prev => prev + 1);
        await fetchNextPage();
      }
    } catch (err) {
      handleError(err, ErrorType.CONTAINER_CONTENTS_LOAD_MORE);
    }
  }, [hasMore, isLoading, fetchNextPage]);

  const handleRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      await refetch();
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      handleError(err, ErrorType.CONTAINER_CONTENTS_REFRESH);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, onRefresh]);

  const renderFooter = useMemo(() => {
    if (!hasMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }, [hasMore, theme.colors.primary]);

  const renderItem = useCallback(({ item }: { item: Item }) => (
    <ItemCard 
      item={item}
      onPress={() => onItemPress?.(item)}
    />
  ), [onItemPress]);

  const keyExtractor = useCallback((item: Item) => 
    item.id?.toString() || '', 
  []);

  const renderEmptyComponent = useMemo(() => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: theme.colors.text }]}>
        Aucun article dans ce container
      </Text>
    </View>
  ), [theme.colors.text]);

  if (isLoading && items.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {error.message}
        </Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
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
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
            />
          }
          contentContainerStyle={items.length === 0 && styles.emptyListContent}
        />
        {totalCount > 0 && (
          <View style={[styles.paginationInfo, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.paginationText, { color: theme.colors.text }]}>
              {`${items.length} sur ${totalCount} articles`}
            </Text>
          </View>
        )}
      </View>
    </ErrorBoundary>
  );
});

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
    borderTopColor: '#ddd',
  },
  paginationText: {
    textAlign: 'center',
  },
}); 