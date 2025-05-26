import { supabase } from '../config/supabase';
import { Item } from '../types/item';
import { handleDatabaseError } from '../utils/errorHandler';
import { PostgrestError } from '@supabase/supabase-js';

export interface SearchFilters {
  search?: string;
  categoryId?: number;
  containerId?: number | 'none';
  status?: 'all' | 'available' | 'sold';
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  pageSize?: number;
}

export interface SearchResponse {
  items: Item[];
  total: number;
  hasMore: boolean;
}

export const searchItems = async (filters: SearchFilters): Promise<SearchResponse> => {
  try {
    let query = supabase
      .from('items')
      .select('*', { count: 'exact' })
      .is('deleted', false);

    // Application des filtres
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`); // Restored original OR condition
    }

    if (filters.categoryId) {
      query = query.eq('category_id', filters.categoryId);
    }

    if (filters.containerId) {
      if (filters.containerId === 'none') {
        query = query.is('container_id', null);
      } else {
        query = query.eq('container_id', filters.containerId);
      }
    }

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters.minPrice) {
      query = query.gte('selling_price', filters.minPrice);
    }

    if (filters.maxPrice) {
      query = query.lte('selling_price', filters.maxPrice);
    }

    // Pagination
    const page = filters.page || 0;
    const pageSize = filters.pageSize || 20;
    const start = page * pageSize;

    query = query
      .order('created_at', { ascending: false })
      .range(start, start + pageSize - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    const items = (data || []).map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
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
      hasMore: count ? start + pageSize < count : false
    };
  } catch (error) {
    if (error instanceof Error || 'code' in (error as any)) {
      throw handleDatabaseError(error as Error | PostgrestError);
    }
    throw error;
  }
};

export const searchItemsByBarcode = async (barcode: string): Promise<Item | null> => {
  try {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('qr_code', barcode)
      .is('deleted', false)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Aucun résultat trouvé
      }
      throw error;
    }

    return data ? {
      id: data.id,
      name: data.name,
      description: data.description,
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
    } : null;
  } catch (error) {
    if (error instanceof Error || 'code' in (error as any)) {
      throw handleDatabaseError(error as Error | PostgrestError);
    }
    throw error;
  }
};

export const searchSimilarItems = async (itemName: string, limit: number = 5): Promise<Item[]> => {
  try {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .is('deleted', false)
      .ilike('name', `%${itemName}%`)
      .limit(limit);

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
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
    if (error instanceof Error || 'code' in (error as any)) {
      throw handleDatabaseError(error as Error | PostgrestError);
    }
    throw error;
  }
}; 