import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../store/store';
import { Item } from '../types/item';

export const selectItemsState = (state: RootState) => state.items;

export const selectAllItems = createSelector(
  selectItemsState,
  (itemsState) => Object.values(itemsState.entities) as Item[]
);

export const selectItemById = createSelector(
  [selectItemsState, (state: RootState, itemId: number) => itemId],
  (itemsState, itemId) => itemsState.entities[itemId] as Item | undefined
);

export const selectItemsByContainer = createSelector(
  [selectAllItems, (state: RootState, containerId: number) => containerId],
  (items, containerId) => items.filter(item => item.containerId === containerId)
);

export const selectItemsByCategory = createSelector(
  [selectAllItems, (state: RootState, categoryId: number) => categoryId],
  (items, categoryId) => items.filter(item => item.categoryId === categoryId)
);

export const selectItemsByStatus = createSelector(
  [selectAllItems, (state: RootState, status: Item['status']) => status],
  (items, status) => items.filter(item => item.status === status)
);

export const selectItemsLoading = createSelector(
  selectItemsState,
  (itemsState) => itemsState.status === 'loading'
);

export const selectItemsError = createSelector(
  selectItemsState,
  (itemsState) => itemsState.error
); 