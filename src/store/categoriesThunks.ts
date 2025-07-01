import { createAsyncThunk } from '@reduxjs/toolkit';
import { Category, CategoryInput } from '../types/category';
import { RootState } from './store';
import { supabase } from '../config/supabase';
import { handleDatabaseError } from '../utils/errorHandler';
import { ErrorTypeEnum, ErrorDetails } from '../utils/errorHandler';
import { PostgrestError } from '@supabase/supabase-js';
import { isOfflineMode } from '../utils/offlineUtils';

// Types pour les réponses et erreurs
interface ThunkError {
  message: string;
  type: ErrorTypeEnum;
  originalError: unknown;
}

// Fonction utilitaire pour convertir ErrorDetails en ThunkError
const convertToThunkError = (error: ErrorDetails): ThunkError => ({
  message: error.message,
  type: error.type,
  originalError: error.originalError || error
});

// Fonction utilitaire pour gérer les erreurs
const handleThunkError = (error: unknown): ThunkError => {
  const errorDetails = handleDatabaseError(
    error instanceof Error || (error && typeof error === 'object' && 'code' in error)
      ? (error as Error | PostgrestError)
      : new Error('Une erreur inconnue est survenue')
  );
  return convertToThunkError(errorDetails);
};

/**
 * Récupérer toutes les catégories
 */
export const fetchCategories = createAsyncThunk<
  Category[],
  void,
  { state: RootState; rejectValue: ThunkError }
>('categories/fetchCategories', async (_, { rejectWithValue }) => {
  try {
    // Vérifier si nous sommes en mode hors ligne (réseau OU forcé)
    if (isOfflineMode()) {
      console.log('[fetchCategories] Mode hors ligne détecté, récupération depuis IndexedDB');
      const { localDB } = await import('../database/localDatabase');
      
      // Récupérer les categories depuis IndexedDB
      const localCategories = await localDB.categories
        .orderBy('createdAt')
        .toArray();
      
      console.log(`[fetchCategories] Récupéré ${localCategories.length} categories depuis IndexedDB`);
      return localCategories;
    }

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('deleted', false)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return data.map(category => ({
      id: category.id,
      name: category.name,
      description: category.description || '',
      createdAt: category.created_at,
      updatedAt: category.updated_at,
      deleted: category.deleted,
      userId: category.user_id,
      icon: category.icon || ''
    }));
  } catch (error) {
    // Si c'est une erreur réseau, essayer IndexedDB comme fallback
    if (error instanceof Error && 
        (error.message.includes('Failed to fetch') || 
         error.message.includes('NetworkError') ||
         error.message.includes('network error'))) {
      console.log('[fetchCategories] Erreur réseau, fallback vers IndexedDB');
      try {
        const { localDB } = await import('../database/localDatabase');
        
        // Récupérer les categories depuis IndexedDB
        const localCategories = await localDB.categories
          .orderBy('createdAt')
          .toArray();
        
        console.log(`[fetchCategories] Récupéré ${localCategories.length} categories depuis IndexedDB`);
        return localCategories;
      } catch (fallbackError) {
        console.error('[fetchCategories] Erreur IndexedDB fallback:', fallbackError);
        return [];
      }
    }
    return rejectWithValue(handleThunkError(error));
  }
});

/**
 * Créer une nouvelle catégorie
 */
export const createCategory = createAsyncThunk<
  Category,
  CategoryInput,
  { state: RootState; rejectValue: ThunkError }
>('categories/createCategory', async (categoryInput, { rejectWithValue }) => {
  try {
    // Récupérer l'utilisateur actuel depuis Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw new Error('Utilisateur non authentifié');
    }

    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: categoryInput.name,
        description: categoryInput.description || '',
        icon: categoryInput.icon || '',
        user_id: user.id, // ✅ AJOUT du user_id requis
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted: false
      })
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new Error('Erreur lors de la création de la catégorie');

    return {
      id: data.id,
      name: data.name,
      description: data.description || '',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      deleted: data.deleted,
      userId: data.user_id,
      icon: data.icon || ''
    };
  } catch (error) {
    return rejectWithValue(handleThunkError(error));
  }
});

/**
 * Mettre à jour une catégorie
 */
export const updateCategory = createAsyncThunk<
  Category,
  { id: number; updates: Partial<CategoryInput> },
  { state: RootState; rejectValue: ThunkError }
>('categories/updateCategory', async ({ id, updates }, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new Error('Catégorie non trouvée');

    return {
      id: data.id,
      name: data.name,
      description: data.description || '',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      deleted: data.deleted,
      userId: data.user_id,
      icon: data.icon || ''
    };
  } catch (error) {
    return rejectWithValue(handleThunkError(error));
  }
});

/**
 * Supprimer une catégorie (soft delete)
 */
export const deleteCategory = createAsyncThunk<
  void,
  number,
  { state: RootState; rejectValue: ThunkError }
>('categories/deleteCategory', async (categoryId, { rejectWithValue }) => {
  try {
    const { error } = await supabase
      .from('categories')
      .update({
        deleted: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', categoryId);

    if (error) throw error;
  } catch (error) {
    return rejectWithValue(handleThunkError(error));
  }
}); 