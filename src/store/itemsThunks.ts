import { createAsyncThunk } from '@reduxjs/toolkit';
import { searchItems, searchItemsByBarcode, searchSimilarItems, SearchFilters } from '../services/searchService';
import { setItems } from './itemsSlice';
import { handleDatabaseError } from '../utils/errorHandler';
import { Item } from '../database/types';
import { supabase } from '../config/supabase';

export const fetchItems = createAsyncThunk(
  'items/fetchItems',
  async (filters: SearchFilters, { rejectWithValue }) => {
    try {
      const response = await searchItems(filters);
      return response;
    } catch (error) {
      return rejectWithValue(handleDatabaseError(error as Error, 'fetchItems'));
    }
  }
);

export const fetchItemByBarcode = createAsyncThunk(
  'items/fetchItemByBarcode',
  async (barcode: string, { rejectWithValue }) => {
    try {
      const item = await searchItemsByBarcode(barcode);
      return item;
    } catch (error) {
      return rejectWithValue(handleDatabaseError(error as Error, 'fetchItemByBarcode'));
    }
  }
);

export const fetchSimilarItems = createAsyncThunk(
  'items/fetchSimilarItems',
  async ({ name, limit }: { name: string; limit?: number }, { rejectWithValue }) => {
    try {
      const items = await searchSimilarItems(name, limit);
      return items;
    } catch (error) {
      return rejectWithValue(handleDatabaseError(error as Error, 'fetchSimilarItems'));
    }
  }
);

export const updateItemStatus = createAsyncThunk(
  'items/updateStatus',
  async ({ 
    itemId, 
    status, 
    soldAt 
  }: { 
    itemId: number; 
    status: 'available' | 'sold'; 
    soldAt?: string 
  }, 
  { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('items')
        .update({ 
          status, 
          sold_at: soldAt || (status === 'sold' ? new Date().toISOString() : null)
        })
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;
      return data as Item;
    } catch (error) {
      return rejectWithValue(handleDatabaseError(error as Error, 'updateItemStatus'));
    }
  }
);

export const moveItem = createAsyncThunk(
  'items/moveItem',
  async ({ 
    itemId, 
    containerId 
  }: { 
    itemId: number; 
    containerId: number | null 
  }, 
  { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('items')
        .update({ container_id: containerId })
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;
      return data as Item;
    } catch (error) {
      return rejectWithValue(handleDatabaseError(error as Error, 'moveItem'));
    }
  }
);

export const bulkUpdateItems = createAsyncThunk(
  'items/bulkUpdate',
  async ({ 
    itemIds, 
    updates 
  }: { 
    itemIds: number[]; 
    updates: Partial<Item> 
  }, 
  { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('items')
        .update(updates)
        .in('id', itemIds)
        .select();

      if (error) throw error;
      return data as Item[];
    } catch (error) {
      return rejectWithValue(handleDatabaseError(error as Error, 'bulkUpdateItems'));
    }
  }
); 