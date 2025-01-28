import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Category, addCategory } from '../database/database';

interface CategoryState {
  categories: Category[];
}

const initialState: CategoryState = {
  categories: []
};

const categorySlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {
    setCategories: (state, action: PayloadAction<Category[]>) => {
      state.categories = action.payload;
    },
    addNewCategory: (state, action: PayloadAction<Category>) => {
      state.categories.push(action.payload);
    },
    editCategory: (state, action: PayloadAction<{ id: number; name: string }>) => {
      const { id, name } = action.payload;
      const category = state.categories.find((cat: Category) => cat.id === id);
      if (category) {
        category.name = name;
      }
    },
    deleteCategory: (state, action: PayloadAction<number>) => {
      state.categories = state.categories.filter((cat: Category) => cat.id !== action.payload);
    },
    resetCategories: (state) => {
      state.categories = [];
    }
  }
});

export const { setCategories, addNewCategory, editCategory, deleteCategory, resetCategories } = categorySlice.actions;
export default categorySlice.reducer;