import { configureStore } from '@reduxjs/toolkit';
import categoryReducer from './categorySlice';
import itemsReducer from './itemsSlice';
import containersReducer from './containersSlice';
import { ContainersState } from './containersSlice';

const initialState: {
  items: { items: any[] },
  categories: { categories: any[] },
  containers: ContainersState
} = {
  items: {
    items: [] as any[]
  },
  categories: {
    categories: [] as any[]
  },
  containers: {
    containers: [],
    status: 'idle',
    error: null,
    loading: false
  }
};

export const store = configureStore({
  reducer: {
    categories: categoryReducer,
    items: itemsReducer,
    containers: containersReducer,
  },
  preloadedState: initialState
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;