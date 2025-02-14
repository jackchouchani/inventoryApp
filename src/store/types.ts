import { Item } from '../types/item';

export interface ItemsState {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  searchResults: Item[];
  selectedItem: Item | null;
  similarItems: Item[];
  currentPage: number;
  totalItems: number;
  hasMore: boolean;
}

export interface CategoriesState {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

export interface ContainersState {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  loading: boolean;
} 