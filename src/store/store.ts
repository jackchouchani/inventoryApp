import { configureStore } from '@reduxjs/toolkit';
import categoryReducer from './categorySlice';
import itemsReducer from './itemsSlice';
import containersReducer from './containersSlice';
import { ContainersState } from './containersSlice';
import { categoriesAdapter } from './categorySlice';
import { itemsAdapter } from './itemsSlice';
import { containersAdapter } from './containersSlice';
import { Item } from '../database/types';

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

const initialState = {
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
};

export const store = configureStore({
  reducer: {
    categories: categoryReducer,
    items: itemsReducer,
    containers: containersReducer,
  },
  preloadedState: initialState,
});