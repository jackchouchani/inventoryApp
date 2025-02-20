import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { deleteCategory, setCategories } from '../store/categorySlice';
import { database } from '../database/database';
import type { Category } from '../types/category';
import { selectAllCategories } from '../store/categorySlice';

export const useCategories = () => {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const categories = useSelector((state: RootState) => selectAllCategories(state)) as Category[];

  const loadCategories = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const loadedCategories = await database.getCategories();
      dispatch(setCategories(loadedCategories));
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error);
      setError('Erreur lors du chargement des catégories');
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  const handleDeleteCategory = async (categoryId: number): Promise<void> => {
    try {
      if (categoryId == null) {
        throw new Error('ID de catégorie manquant');
      }
      dispatch(deleteCategory(categoryId));
      await database.deleteCategory(categoryId);
    } catch (error) {
      console.error('Erreur:', error);
      throw new Error('Impossible de supprimer la catégorie');
    }
  };

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  return {
    categories,
    isLoading,
    error,
    loadCategories,
    handleDeleteCategory
  };
}; 