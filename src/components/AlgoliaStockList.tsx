import React, { useEffect } from 'react';
import { InstantSearch } from 'react-instantsearch';
import { searchClient, INDEX_NAME } from '../config/algolia';
import ItemList from './ItemList';
import { useAlgoliaSearch } from '../hooks/useAlgoliaSearch';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

interface AlgoliaStockListProps {
  searchQuery: string;
  onItemPress: (item: any) => void;
  onMarkAsSold: (item: any) => void;
  onMarkAsAvailable: (item: any) => void;
  categories: any[];
  containers: any[];
  selectedItem: any;
  onEditSuccess: () => void;
  onEditCancel: () => void;
  onEndReached: () => void;
  isLoadingMore: boolean;
  onLoadingChange?: (isLoading: boolean) => void;
  onNbHitsChange?: (nbHits: number) => void;
}

const AlgoliaStockListInner: React.FC<AlgoliaStockListProps> = (props) => {
  const {
    items,
    isLoading,
    nbHits,
    search,
  } = useAlgoliaSearch();

  useEffect(() => {
    if (props.onLoadingChange) {
      props.onLoadingChange(isLoading);
    }
  }, [isLoading, props.onLoadingChange]);

  useEffect(() => {
    if (props.onNbHitsChange) {
      props.onNbHitsChange(nbHits);
    }
  }, [nbHits, props.onNbHitsChange]);

  useEffect(() => {
    search(props.searchQuery);
  }, [props.searchQuery, search]);

  return (
    <>
      {!isLoading && nbHits === 0 && (
        <View style={styles.noResultsContainer}>
          <Text style={styles.noResultsText}>Aucun article trouvé.</Text>
        </View>
      )}
      <ItemList
        items={items}
        onItemPress={props.onItemPress}
        onMarkAsSold={props.onMarkAsSold}
        onMarkAsAvailable={props.onMarkAsAvailable}
        categories={props.categories}
        containers={props.containers}
        onEndReached={props.onEndReached}
        isLoadingMore={props.isLoadingMore}
      />
    </>
  );
};

export const AlgoliaStockList: React.FC<AlgoliaStockListProps> = (props) => (
  <InstantSearch 
    searchClient={searchClient as any} 
    indexName={INDEX_NAME}
  >
    <AlgoliaStockListInner {...props} />
  </InstantSearch>
);

export default AlgoliaStockList;

const styles = StyleSheet.create({
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  } as ViewStyle,
  noResultsText: {
    fontSize: 16,
    color: '#666',
  } as TextStyle,
});