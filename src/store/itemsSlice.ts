import { createSlice } from '@reduxjs/toolkit';
import { Item } from '../types/item';
import { itemsAdapter, ItemWithId } from './itemsAdapter';
import {
  fetchItems,
  fetchItemByBarcode,
  fetchItemById,
  fetchSimilarItems,
  updateItemStatus,
  sellItem,
  moveItem,
  bulkUpdateItems
} from './itemsThunks';
import {
  setItems,
  addItem,
  updateItem,
  removeItem,
  setSelectedItem,
  clearSearchResults,
  resetState
} from './itemsActions';

interface ThunkError {
  message: string;
  code?: string;
  stack?: string;
}

// Définition du state initial
const initialState = itemsAdapter.getInitialState({
  status: 'idle' as 'idle' | 'loading' | 'succeeded' | 'failed',
  error: null as string | null,
  searchResults: [] as Item[],
  selectedItem: null as Item | null,
  similarItems: [] as Item[],
  currentPage: 0,
  totalItems: 0,
  hasMore: false,
});

// Création du slice
const itemsSlice = createSlice({
  name: 'items',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Actions synchrones
      .addCase(setItems, (state, action) => {
        const itemsWithId = action.payload.filter((item): item is ItemWithId => item.id !== undefined);
        itemsAdapter.setAll(state, itemsWithId);
      })
      .addCase(addItem, (state, action) => {
        if (action.payload.id) {
          itemsAdapter.addOne(state, action.payload as ItemWithId);
        }
      })
      .addCase(updateItem, (state, action) => {
        if (action.payload.id) {
          itemsAdapter.updateOne(state, {
            id: action.payload.id,
            changes: action.payload,
          });
        }
      })
      .addCase(removeItem, (state, action) => {
        itemsAdapter.removeOne(state, action.payload);
      })
      .addCase(setSelectedItem, (state, action) => {
        state.selectedItem = action.payload;
      })
      .addCase(clearSearchResults, (state) => {
        state.searchResults = [];
      })
      .addCase(resetState, () => initialState)
      // Actions asynchrones
      .addCase(fetchItems.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchItems.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.searchResults = action.payload.items;
        state.totalItems = action.payload.total;
        state.hasMore = action.payload.hasMore;
        state.currentPage = state.currentPage + 1;
        itemsAdapter.setMany(state, action.payload.items as ItemWithId[]);
      })
      .addCase(fetchItems.rejected, (state, action) => {
        state.status = 'failed';
        const error = action.payload as ThunkError | undefined;
        state.error = error?.message || 'Une erreur est survenue';
      })
      .addCase(fetchItemByBarcode.fulfilled, (state, action) => {
        if (action.payload) {
          state.selectedItem = action.payload;
          itemsAdapter.upsertOne(state, action.payload as ItemWithId);
        }
      })
      .addCase(fetchItemById.fulfilled, (state, action) => {
        if (action.payload) {
          state.selectedItem = action.payload;
          itemsAdapter.upsertOne(state, action.payload as ItemWithId);
        }
      })
      .addCase(fetchSimilarItems.fulfilled, (state, action) => {
        state.similarItems = action.payload;
        itemsAdapter.upsertMany(state, action.payload as ItemWithId[]);
      })
      .addCase(updateItemStatus.fulfilled, (state, action) => {
        itemsAdapter.upsertOne(state, action.payload as ItemWithId);
        if (state.selectedItem?.id === action.payload.id) {
          state.selectedItem = action.payload;
        }
      })
      .addCase(sellItem.fulfilled, (state, action) => {
        itemsAdapter.upsertOne(state, action.payload as ItemWithId);
        if (state.selectedItem?.id === action.payload.id) {
          state.selectedItem = action.payload;
        }
      })
      .addCase(moveItem.fulfilled, (state, action) => {
        itemsAdapter.upsertOne(state, action.payload as ItemWithId);
        if (state.selectedItem?.id === action.payload.id) {
          state.selectedItem = action.payload;
        }
      })
      .addCase(bulkUpdateItems.fulfilled, (state, action) => {
        itemsAdapter.upsertMany(state, action.payload as ItemWithId[]);
      });
  }
});

export default itemsSlice.reducer; 