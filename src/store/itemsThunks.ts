import { createAsyncThunk } from '@reduxjs/toolkit';
import { Item } from '../types/item';
import { RootState } from './store';
import { supabase } from '../config/supabase';
import { handleDatabaseError } from '../utils/errorHandler';
import { ErrorTypeEnum, ErrorDetails } from '../utils/errorHandler';
import { PostgrestError } from '@supabase/supabase-js';

// Types pour les réponses et erreurs
interface FetchItemsResponse {
  items: Item[];
  total: number;
  hasMore: boolean;
}

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
    return rejectWithValue(handleThunkError(error));
  }
});

export const fetchItemById = createAsyncThunk<
  Item | null,
  number,
  { state: RootState; rejectValue: ThunkError }
>('items/fetchItemById', async (itemId, { rejectWithValue }) => {
  try {
    console.log('[REDUX] Fetching item by ID:', itemId);
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('id', itemId)
      .eq('deleted', false)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows returned
      throw error;
    }

    if (!data) return null;

    console.log('[REDUX] Item fetched successfully:', data);
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
    return rejectWithValue(handleThunkError(error));
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
    return rejectWithValue(handleThunkError(error));
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
    return rejectWithValue(handleThunkError(error));
  }
});

export const updateItemStatus = createAsyncThunk<
  Item,
  { itemId: number; status: string },
  { state: RootState; rejectValue: ThunkError }
>('items/updateItemStatus', async ({ itemId, status }, { rejectWithValue }) => {
  try {
    console.log('[REDUX updateItemStatus] Changement statut:', { itemId, status });
    
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

    console.log('[REDUX updateItemStatus] Données fraîches récupérées:', data);

    // Retourner les données complètes et fraîches de la DB
    return {
      id: data.id,
      name: data.name,
      description: data.description || '',
      purchasePrice: data.purchase_price,
      sellingPrice: data.selling_price, // Prix récupéré de la DB
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
    console.error('[REDUX updateItemStatus] Erreur:', error);
    return rejectWithValue(handleThunkError(error));
  }
});

// Nouveau thunk pour vendre un article avec prix et date
export const sellItem = createAsyncThunk<
  Item,
  { itemId: number; soldDate: string; salePrice: number },
  { state: RootState; rejectValue: ThunkError }
>('items/sellItem', async ({ itemId, soldDate, salePrice }, { rejectWithValue }) => {
  try {
    console.log('[REDUX sellItem] Vente article:', { itemId, soldDate, salePrice });
    
    const { data, error } = await supabase
      .from('items')
      .update({
        status: 'sold',
        selling_price: salePrice,
        sold_at: soldDate,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new Error('Item non trouvé');

    console.log('[REDUX sellItem] Succès:', data);

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
    console.error('[REDUX sellItem] Erreur:', error);
    return rejectWithValue(handleThunkError(error));
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
    return rejectWithValue(handleThunkError(error));
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
    return rejectWithValue(handleThunkError(error));
  }
});

/**
 * Créer un nouvel item
 */
export const createItem = createAsyncThunk<
  Item,
  { name: string; description?: string; purchasePrice: number; sellingPrice: number; categoryId: number; containerId?: number | null; locationId?: number | null; qrCode: string; photo_storage_url?: string },
  { state: RootState; rejectValue: ThunkError }
>('items/createItem', async (itemData, { rejectWithValue }) => {
  try {
    // Récupérer l'utilisateur actuel depuis Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw new Error('Utilisateur non authentifié');
    }

    const { data, error } = await supabase
      .from('items')
      .insert({
        name: itemData.name,
        description: itemData.description || '',
        purchase_price: itemData.purchasePrice,
        selling_price: itemData.sellingPrice,
        status: 'available',
        category_id: itemData.categoryId,
        container_id: itemData.containerId || null,
        location_id: itemData.locationId || null,
        qr_code: itemData.qrCode,
        photo_storage_url: itemData.photo_storage_url || null,
        user_id: user.id, // ✅ AJOUT du user_id requis
        created_by: user.id, // ✅ AJOUT du created_by requis
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted: false
      })
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new Error('Erreur lors de la création de l\'article');

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
    return rejectWithValue(handleThunkError(error));
  }
});

/**
 * Mettre à jour un item
 */
export const updateItem = createAsyncThunk<
  Item,
  { id: number; updates: Partial<{ name: string; description: string; purchasePrice: number; sellingPrice: number; categoryId: number; containerId: number | null; locationId: number | null; photo_storage_url: string | null }> },
  { state: RootState; rejectValue: ThunkError }
>('items/updateItem', async ({ id, updates }, { rejectWithValue }) => {
  try {
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.purchasePrice !== undefined) updateData.purchase_price = updates.purchasePrice;
    if (updates.sellingPrice !== undefined) updateData.selling_price = updates.sellingPrice;
    if (updates.categoryId !== undefined) updateData.category_id = updates.categoryId;
    if (updates.containerId !== undefined) updateData.container_id = updates.containerId;
    if (updates.locationId !== undefined) updateData.location_id = updates.locationId;
    if (updates.photo_storage_url !== undefined) updateData.photo_storage_url = updates.photo_storage_url;

    const { data, error } = await supabase
      .from('items')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new Error('Article non trouvé');

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
    return rejectWithValue(handleThunkError(error));
  }
});

/**
 * Supprimer un item (soft delete)
 */
export const deleteItem = createAsyncThunk<
  void,
  number,
  { state: RootState; rejectValue: ThunkError }
>('items/deleteItem', async (itemId, { rejectWithValue }) => {
  try {
    const { error } = await supabase
      .from('items')
      .update({
        deleted: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId);

    if (error) throw error;
  } catch (error) {
    return rejectWithValue(handleThunkError(error));
  }
});

/**
 * Vider un container - retirer tous les items du container
 */
export const clearContainer = createAsyncThunk<
  void,
  { containerId: number },
  { state: RootState; rejectValue: ThunkError }
>('items/clearContainer', async ({ containerId }, { rejectWithValue }) => {
  try {
    console.log('[REDUX] Clearing container:', containerId);
    
    // Mettre à jour tous les items du container pour retirer le containerId
    const { error } = await supabase
      .from('items')
      .update({ 
        container_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('container_id', containerId)
      .eq('deleted', false);

    if (error) throw error;

    console.log('[REDUX] Container cleared successfully');
  } catch (error) {
    console.error('[REDUX] Error clearing container:', error);
    return rejectWithValue(handleThunkError(error));
  }
}); 