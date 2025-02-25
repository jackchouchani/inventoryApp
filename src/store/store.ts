import { configureStore } from '@reduxjs/toolkit';
import itemsReducer from './itemsSlice';
import categoriesReducer from './categorySlice';
import containersReducer from './containersSlice';
import { categoriesAdapter } from './categorySlice';
import { itemsAdapter } from './itemsAdapter';
import { containersAdapter } from './containersSlice';
import { Item } from '../types/item';
import { errorMiddleware } from './middleware/errorMiddleware';

export const store = configureStore({
  reducer: {
    items: itemsReducer,
    categories: categoriesReducer,
    containers: containersReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(errorMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const getInitialState = () => ({
  items: itemsAdapter.getInitialState({
    status: 'idle' as const,
    error: null as string | null,
    searchResults: [] as Item[],
    selectedItem: null as Item | null,
    similarItems: [] as Item[],
    currentPage: 0,
    totalItems: 0,
    hasMore: false,
  }),
  categories: categoriesAdapter.getInitialState({
    status: 'idle' as const,
    error: null as string | null,
  }),
  containers: containersAdapter.getInitialState({
    status: 'idle' as const,
    error: null as string | null,
    loading: false,
  }),
});