import { createSlice, createEntityAdapter, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { Category } from '../types/category';
import { RootState } from './store';
import { fetchCategories, createCategory, updateCategory, deleteCategory as deleteCategoryThunk } from './categoriesThunks';

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
  offline: {
    isOffline: false,
    lastSyncTime: null,
    pendingEvents: 0,
    syncInProgress: false,
    syncErrors: []
  },
  localChanges: 0,
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
  },
  extraReducers: (builder) => {
    builder
      // fetchCategories
      .addCase(fetchCategories.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.status = 'succeeded';
        const categoriesWithId = action.payload.filter((category): category is CategoryWithId => category.id !== undefined);
        categoriesAdapter.setAll(state, categoriesWithId);
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.status = 'failed';
        state.error = (action.payload as any)?.message || 'Erreur lors du chargement des catégories';
      })
      // createCategory
      .addCase(createCategory.fulfilled, (state, action) => {
        if (action.payload.id) {
          categoriesAdapter.addOne(state, action.payload as CategoryWithId);
        }
      })
      // updateCategory
      .addCase(updateCategory.fulfilled, (state, action) => {
        if (action.payload.id) {
          categoriesAdapter.updateOne(state, {
            id: action.payload.id,
            changes: action.payload
          });
        }
      })
      // deleteCategory
      .addCase(deleteCategoryThunk.fulfilled, (state, action) => {
        // La payload contient l'ID de la catégorie supprimée
        // On peut récupérer l'ID depuis l'action.meta.arg
        const categoryId = action.meta.arg;
        categoriesAdapter.removeOne(state, categoryId);
      });
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
    return categories.map((category: any) => ({
      ...category,
      itemCount: Object.values(itemsState.entities || {}).filter(
        (item: any) => item?.categoryId === category.id
      ).length
    }));
  }
);

export const selectCategoryByName = createSelector(
  [selectAllCategories, (_state, name: string) => name.toLowerCase()],
  (categories, name) => categories.find(
    category => category.name.toLowerCase() === name
  )
);

// Ajout des nouveaux sélecteurs
export const selectCategoriesStatus = (state: RootState) => state.categories.status;
export const selectCategoriesError = (state: RootState) => state.categories.error;

export const { setCategories, addNewCategory, editCategory, deleteCategory, resetCategories } = categorySlice.actions;
export default categorySlice.reducer;