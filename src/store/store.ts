import { configureStore } from '@reduxjs/toolkit';
import categoryReducer from './categorySlice';
import itemsReducer from './itemsSlice';

const initialState = {
  items: {
    items: []
  },
  // autres états initiaux...
};

export const store = configureStore({
  reducer: {
    categories: categoryReducer,
    items: itemsReducer
  },
  preloadedState: initialState
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;