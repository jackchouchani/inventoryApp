import { configureStore, Middleware } from '@reduxjs/toolkit';
import itemsReducer from './itemsSlice';
import categoriesReducer from './categorySlice';
import containersReducer from './containersSlice';
import locationsReducer from './locationsSlice';
import { categoriesAdapter } from './categorySlice';
import { itemsAdapter } from './itemsAdapter';
import { containersAdapter } from './containersSlice';
import { locationsAdapter } from './locationsSlice';
import { Item } from '../types/item';
import { errorMiddleware } from './middleware/errorMiddleware';
import { offlineMiddleware } from './middleware/offlineMiddleware';

const rootReducer = {
  items: itemsReducer,
  categories: categoriesReducer,
  containers: containersReducer,
  locations: locationsReducer,
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST']
      }
    })
      .concat(offlineMiddleware as Middleware)
      .concat(errorMiddleware as Middleware),
});

export type RootState = ReturnType<(typeof store)['getState']>;
export type AppDispatch = (typeof store)['dispatch'];

const getDefaultOfflineMetadata = () => ({
  isOffline: false,
  lastSyncTime: null,
  pendingEvents: 0,
  syncInProgress: false,
  syncErrors: []
});

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
    offline: getDefaultOfflineMetadata(),
    localChanges: 0,
  }),
  categories: categoriesAdapter.getInitialState({
    status: 'idle' as const,
    error: null as string | null,
    offline: getDefaultOfflineMetadata(),
    localChanges: 0,
  }),
  containers: containersAdapter.getInitialState({
    status: 'idle' as const,
    error: null as string | null,
    loading: false,
    offline: getDefaultOfflineMetadata(),
    localChanges: 0,
  }),
  locations: locationsAdapter.getInitialState({
    status: 'idle' as const,
    error: null as string | null,
    loading: false,
    offline: getDefaultOfflineMetadata(),
    localChanges: 0,
  }),
});