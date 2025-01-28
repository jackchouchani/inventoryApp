import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Category {
  id: string;
  name: string;
}

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
    addCategory: (state, action: PayloadAction<string>) => {
      state.categories.push({
        id: Date.now().toString(),
        name: action.payload
      });
    },
    editCategory: (state, action: PayloadAction<{ id: string; name: string }>) => {
      const { id, name } = action.payload;
      const category = state.categories.find(cat => cat.id === id);
      if (category) {
        category.name = name;
      }
    },
    deleteCategory: (state, action: PayloadAction<string>) => {
      state.categories = state.categories.filter(cat => cat.id !== action.payload);
    },
    resetCategories: (state) => {
      state.categories = [];
    }
  }
});

export const { setCategories, addCategory, editCategory, deleteCategory, resetCategories } = categorySlice.actions;
export default categorySlice.reducer;