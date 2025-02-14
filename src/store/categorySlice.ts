import { createSlice, createEntityAdapter, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { Category } from '../types/category';
import { RootState } from './store';

// Type étendu pour garantir un ID non-null
export type CategoryWithId = Category;

// Création de l'adaptateur pour les catégories
export const categoriesAdapter = createEntityAdapter<CategoryWithId>({
  sortComparer: (a: CategoryWithId, b: CategoryWithId) => a.name.localeCompare(b.name),
});

// État initial avec l'adaptateur
const initialState = categoriesAdapter.getInitialState({
  status: 'idle' as 'idle' | 'loading' | 'succeeded' | 'failed',
  error: null as string | null,
});

const categorySlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {
    setCategories: (state, action: PayloadAction<Category[]>) => {
      const categoriesWithId = action.payload.filter((category): category is CategoryWithId => category.id !== undefined);
      categoriesAdapter.setAll(state, categoriesWithId);
    },
    addNewCategory: (state, action: PayloadAction<Category>) => {
      if (action.payload.id) {
        categoriesAdapter.addOne(state, action.payload as CategoryWithId);
      }
    },
    editCategory: (state, action: PayloadAction<Category>) => {
      if (action.payload.id) {
        const { id, ...changes } = action.payload;
        categoriesAdapter.updateOne(state, {
          id,
          changes
        });
      }
    },
    deleteCategory: (state, action: PayloadAction<number>) => {
      categoriesAdapter.removeOne(state, action.payload);
    },
    resetCategories: (state) => {
      categoriesAdapter.removeAll(state);
    }
  }
});

// Sélecteurs de base
export const {
  selectAll: selectAllCategories,
  selectById: selectCategoryById,
  selectIds: selectCategoryIds,
  selectTotal: selectTotalCategories,
} = categoriesAdapter.getSelectors<RootState>((state) => state.categories);

// Sélecteurs mémorisés
export const selectCategoriesWithItemCount = createSelector(
  [selectAllCategories, (state: RootState) => state.items],
  (categories, itemsState) => {
    return categories.map(category => ({
      ...category,
      itemCount: Object.values(itemsState.entities || {}).filter(
        item => item?.categoryId === category.id
      ).length
    }));
  }
);

export const selectCategoryByName = createSelector(
  [selectAllCategories, (state, name: string) => name.toLowerCase()],
  (categories, name) => categories.find(
    category => category.name.toLowerCase() === name
  )
);

// Ajout des nouveaux sélecteurs
export const selectCategoriesStatus = (state: RootState) => state.categories.status;
export const selectCategoriesError = (state: RootState) => state.categories.error;

export const { setCategories, addNewCategory, editCategory, deleteCategory, resetCategories } = categorySlice.actions;
export default categorySlice.reducer;