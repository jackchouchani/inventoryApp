import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Item } from '../database/database';

interface ItemsState {
  items: Item[];
}

const initialState: ItemsState = {
  items: []
};

const itemsSlice = createSlice({
  name: 'items',
  initialState,
  reducers: {
    setItems: (state, action: PayloadAction<Item[]>) => {
      state.items = action.payload;
    },
    addItem: (state, action: PayloadAction<Item>) => {
      state.items.push(action.payload);
    },
    updateItem: (state, action: PayloadAction<Item>) => {
      const index = state.items.findIndex(item => item.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    removeItem: (state, action: PayloadAction<number>) => {
      state.items = state.items.filter(item => item.id !== action.payload);
    }
  }
});

export const { setItems, addItem, updateItem, removeItem } = itemsSlice.actions;
export default itemsSlice.reducer; 