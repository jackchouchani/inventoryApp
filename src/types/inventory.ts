import type { Item } from './item';

export interface UseInventoryFilters {
  search?: string;
  categoryId?: number;
  containerId?: number | 'none';
  status?: 'all' | 'available' | 'sold';
  minPrice?: number;
  maxPrice?: number;
}

export interface InventoryData {
  items: Array<{
    id: number;
    name: string;
    description?: string;
    purchasePrice: number;
    sellingPrice: number;
    status: 'available' | 'sold';
    photo_storage_url?: string;
    containerId?: number;
    categoryId?: number;
    qrCode?: string;
    createdAt: string;
    updatedAt: string;
    quantity: number;
  }>;
  containers: Array<{
    id: number;
    name: string;
    number: string;
    description?: string;
    qrCode?: string;
    createdAt: string;
    updatedAt: string;
    capacity: number;
    currentItems: number;
  }>;
  categories: Array<{
    id: number;
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface FetchItemsResponse {
  items: Item[];
  nextCursor?: number;
  hasMore: boolean;
} 