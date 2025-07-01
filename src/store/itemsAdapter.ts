import { createEntityAdapter, createSelector } from '@reduxjs/toolkit';
import { Item } from '../types/item';
import { ItemsState } from './types';

// Type étendu pour garantir un ID non-null
export type ItemWithId = Item;

// Création de l'adaptateur d'entités
export const itemsAdapter = createEntityAdapter<ItemWithId>({
  sortComparer: (a: ItemWithId, b: ItemWithId) => {
    const aDate = a.createdAt || '';
    const bDate = b.createdAt || '';
    return bDate.localeCompare(aDate);
  }
});

// Sélecteurs générés par l'adaptateur
export const {
  selectAll: selectAllItems,
  selectById: selectItemById,
  selectIds: selectItemIds,
} = itemsAdapter.getSelectors<{ items: ReturnType<typeof itemsAdapter.getInitialState> & ItemsState }>((state) => state.items);

// Sélecteurs mémorisés
export const selectItemsByContainer = createSelector(
  [selectAllItems, (_state, containerId: number) => containerId],
  (items, containerId) => items.filter(item => item.containerId === containerId)
);

export const selectItemsByCategory = createSelector(
  [selectAllItems, (_state, categoryId: number) => categoryId],
  (items, categoryId) => items.filter(item => item.categoryId === categoryId)
);

export const selectFilteredItems = createSelector(
  [selectAllItems, (_state, filter: string) => filter.toLowerCase()],
  (items, filter) => {
    if (!filter) return items;
    return items.filter(item => 
      item.name.toLowerCase().includes(filter) ||
      item.description?.toLowerCase().includes(filter)
    );
  }
);

// Sélecteurs pour les statistiques
export const selectItemsStatistics = createSelector(
  [selectAllItems],
  (items) => {
    const stats = {
      totalItems: items.length,
      totalValue: 0,
      averagePrice: 0,
      totalProfit: 0,
      itemsByStatus: {
        available: 0,
        sold: 0
      },
      profitMargin: 0,
      bestSellingItems: [] as ItemWithId[],
      worstSellingItems: [] as ItemWithId[]
    };

    items.forEach(item => {
      stats.totalValue += item.sellingPrice;
      stats.totalProfit += item.sellingPrice - item.purchasePrice;
      stats.itemsByStatus[item.status]++;
    });

    stats.averagePrice = stats.totalValue / (stats.totalItems || 1);
    stats.profitMargin = (stats.totalProfit / stats.totalValue) * 100;

    const sortedItems = [...items].sort((a, b) => 
      (b.sellingPrice - b.purchasePrice) - (a.sellingPrice - a.purchasePrice)
    );

    stats.bestSellingItems = sortedItems.slice(0, 5);
    stats.worstSellingItems = sortedItems.slice(-5).reverse();

    return stats;
  }
);

// Sélecteurs d'état
export const selectItemsStatus = (state: { items: ReturnType<typeof itemsAdapter.getInitialState> & ItemsState }) => state.items.status;
export const selectItemsError = (state: { items: ReturnType<typeof itemsAdapter.getInitialState> & ItemsState }) => state.items.error;
export const selectSearchResults = (state: { items: ReturnType<typeof itemsAdapter.getInitialState> & ItemsState }) => state.items.searchResults;
export const selectSelectedItem = (state: { items: ReturnType<typeof itemsAdapter.getInitialState> & ItemsState }) => state.items.selectedItem;
export const selectSimilarItems = (state: { items: ReturnType<typeof itemsAdapter.getInitialState> & ItemsState }) => state.items.similarItems;
export const selectHasMore = (state: { items: ReturnType<typeof itemsAdapter.getInitialState> & ItemsState }) => state.items.hasMore;
export const selectCurrentPage = (state: { items: ReturnType<typeof itemsAdapter.getInitialState> & ItemsState }) => state.items.currentPage;
export const selectTotalItemsCount = (state: { items: ReturnType<typeof itemsAdapter.getInitialState> & ItemsState }) => state.items.totalItems; 