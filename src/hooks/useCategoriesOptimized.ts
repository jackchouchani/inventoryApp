import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { selectAllCategories } from '../store/categorySlice';
import { fetchCategories, createCategory, updateCategory, deleteCategory } from '../store/categoriesThunks';
import type { Category, CategoryInput } from '../types/category';

/**
 * Hook optimisé pour gérer les catégories avec Redux
 * Remplace useCategories.ts avec accès direct à la database
 */
export const useCategoriesOptimized = () => {
  const dispatch = useDispatch<AppDispatch>();
  const categories = useSelector(selectAllCategories);
  const status = useSelector((state: RootState) => state.categories.status);
  const error = useSelector((state: RootState) => state.categories.error);

  // Chargement automatique si nécessaire
  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchCategories());
    }
  }, [dispatch, status]);

  // Actions optimisées
  const actions = {
    // Rafraîchir les catégories
    refetch: useCallback(async () => {
      return dispatch(fetchCategories()).unwrap();
    }, [dispatch]),

    // Créer une catégorie
    create: useCallback(async (categoryData: CategoryInput) => {
      return dispatch(createCategory(categoryData)).unwrap();
    }, [dispatch]),

    // Mettre à jour une catégorie
    update: useCallback(async (id: number, updates: Partial<CategoryInput>) => {
      return dispatch(updateCategory({ id, updates })).unwrap();
    }, [dispatch]),

    // Supprimer une catégorie
    delete: useCallback(async (categoryId: number) => {
      return dispatch(deleteCategory(categoryId)).unwrap();
    }, [dispatch])
  };

  return {
    // Données
    categories,
    
    // États
    isLoading: status === 'loading',
    error,
    
    // Actions
    ...actions
  };
}; 