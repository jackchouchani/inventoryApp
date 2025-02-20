import { createAsyncThunk } from '@reduxjs/toolkit';
import { Item } from '../types/item';
import { RootState } from './store';
import { supabase } from '../config/supabase';
import { handleDatabaseError } from '../utils/errorHandler';
import { ErrorType } from '../utils/errorHandler';
import { PostgrestError } from '@supabase/supabase-js';

// Types pour les réponses et erreurs
interface FetchItemsResponse {
  items: Item[];
  total: number;
  hasMore: boolean;
}

interface ThunkError {
  message: {
    fr: string;
    en: string;
  };
  type: ErrorType;
  originalError: unknown;
}

// Constantes
const ITEMS_PER_PAGE = 20;

// Fonction utilitaire pour gérer les erreurs
const handleError = (error: unknown): ThunkError => {
  const errorDetails = handleDatabaseError(
    error instanceof Error || (error && typeof error === 'object' && 'code' in error)
      ? (error as Error | PostgrestError)
      : new Error('Une erreur inconnue est survenue')
  );

  return {
    message: {
      fr: errorDetails.message,
      en: errorDetails.message // Pour la cohérence, on utilise le même message
    },
    type: errorDetails.type,
    originalError: error
  };
};

export const fetchItems = createAsyncThunk<
  FetchItemsResponse,
  { page: number; limit: number },
  { state: RootState; rejectValue: ThunkError }
>('items/fetchItems', async ({ page, limit }, { rejectWithValue }) => {
  try {
    const start = page * limit;
    const end = start + limit - 1;

    const { data, error, count } = await supabase
      .from('items')
      .select('*', { count: 'exact' })
      .range(start, end)
      .eq('deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const items = data.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      purchasePrice: item.purchase_price,
      sellingPrice: item.selling_price,
      status: item.status,
      photo_storage_url: item.photo_storage_url,
      containerId: item.container_id,
      categoryId: item.category_id,
      qrCode: item.qr_code,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      soldAt: item.sold_at
    }));

    return {
      items,
      total: count || 0,
      hasMore: (count || 0) > (page + 1) * limit
    };
  } catch (error) {
    return rejectWithValue(handleError(error));
  }
});

export const fetchItemByBarcode = createAsyncThunk<
  Item | null,
  string,
  { state: RootState; rejectValue: ThunkError }
>('items/fetchItemByBarcode', async (barcode, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('qr_code', barcode)
      .eq('deleted', false)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows returned
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      description: data.description || '',
      purchasePrice: data.purchase_price,
      sellingPrice: data.selling_price,
      status: data.status,
      photo_storage_url: data.photo_storage_url,
      containerId: data.container_id,
      categoryId: data.category_id,
      qrCode: data.qr_code,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      soldAt: data.sold_at
    };
  } catch (error) {
    return rejectWithValue(handleError(error));
  }
});

export const fetchSimilarItems = createAsyncThunk<
  Item[],
  number,
  { state: RootState; rejectValue: ThunkError }
>('items/fetchSimilarItems', async (itemId, { rejectWithValue, getState }) => {
  try {
    const state = getState();
    const currentItem = state.items.entities[itemId];
    if (!currentItem) throw new Error('Item non trouvé');

    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('category_id', currentItem.categoryId)
      .eq('deleted', false)
      .neq('id', itemId)
      .limit(5);

    if (error) throw error;

    return data.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      purchasePrice: item.purchase_price,
      sellingPrice: item.selling_price,
      status: item.status,
      photo_storage_url: item.photo_storage_url,
      containerId: item.container_id,
      categoryId: item.category_id,
      qrCode: item.qr_code,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      soldAt: item.sold_at
    }));
  } catch (error) {
    return rejectWithValue(handleError(error));
  }
});

// Type pour les mutations optimistes
interface OptimisticMutation<T> {
  execute: () => Promise<T>;
  optimisticData: T;
  rollback: () => void;
}

// Fonction utilitaire pour gérer les mutations optimistes
const handleOptimisticMutation = async <T>(
  mutation: OptimisticMutation<T>,
  { dispatch, rejectWithValue }: any
) => {
  try {
    // Appliquer la mise à jour optimiste
    mutation.rollback();
    
    // Exécuter la mutation réelle
    const result = await mutation.execute();
    return result;
  } catch (error) {
    // Rollback en cas d'erreur
    mutation.rollback();
    return rejectWithValue(error instanceof Error ? error.message : 'Une erreur est survenue');
  }
};

export const updateItemStatus = createAsyncThunk<
  Item,
  { itemId: number; status: string },
  { state: RootState; rejectValue: ThunkError }
>('items/updateItemStatus', async ({ itemId, status }, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase
      .from('items')
      .update({
        status,
        updated_at: new Date().toISOString(),
        sold_at: status === 'sold' ? new Date().toISOString() : null
      })
      .eq('id', itemId)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new Error('Item non trouvé');

    return {
      id: data.id,
      name: data.name,
      description: data.description || '',
      purchasePrice: data.purchase_price,
      sellingPrice: data.selling_price,
      status: data.status,
      photo_storage_url: data.photo_storage_url,
      containerId: data.container_id,
      categoryId: data.category_id,
      qrCode: data.qr_code,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      soldAt: data.sold_at
    };
  } catch (error) {
    return rejectWithValue(handleError(error));
  }
});

export const moveItem = createAsyncThunk<
  Item,
  { itemId: number; containerId: number | null },
  { state: RootState; rejectValue: ThunkError }
>('items/moveItem', async ({ itemId, containerId }, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase
      .from('items')
      .update({
        container_id: containerId,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new Error('Item non trouvé');

    return {
      id: data.id,
      name: data.name,
      description: data.description || '',
      purchasePrice: data.purchase_price,
      sellingPrice: data.selling_price,
      status: data.status,
      photo_storage_url: data.photo_storage_url,
      containerId: data.container_id,
      categoryId: data.category_id,
      qrCode: data.qr_code,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      soldAt: data.sold_at
    };
  } catch (error) {
    return rejectWithValue(handleError(error));
  }
});

export const bulkUpdateItems = createAsyncThunk<
  Item[],
  { items: Item[] },
  { state: RootState; rejectValue: ThunkError }
>('items/bulkUpdateItems', async ({ items }, { rejectWithValue }) => {
  try {
    const updates = items.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      purchase_price: item.purchasePrice,
      selling_price: item.sellingPrice,
      status: item.status,
      photo_storage_url: item.photo_storage_url,
      container_id: item.containerId,
      category_id: item.categoryId,
      qr_code: item.qrCode,
      updated_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('items')
      .upsert(updates)
      .select('*');

    if (error) throw error;
    if (!data) throw new Error('Erreur lors de la mise à jour en masse');

    return data.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      purchasePrice: item.purchase_price,
      sellingPrice: item.selling_price,
      status: item.status,
      photo_storage_url: item.photo_storage_url,
      containerId: item.container_id,
      categoryId: item.category_id,
      qrCode: item.qr_code,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      soldAt: item.sold_at
    }));
  } catch (error) {
    return rejectWithValue(handleError(error));
  }
}); 