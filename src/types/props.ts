import { Category } from './category';
import { Container } from './container';

export type FilterStatus = 'all' | 'available' | 'sold';

export interface FilterBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onCategoryChange?: (categoryId: number | undefined) => void;
  onContainerChange?: (containerId: number | 'none' | undefined) => void;
  onStatusChange?: (status: FilterStatus) => void;
  onPriceChange?: (min?: number, max?: number) => void;
  categories?: Category[];
  containers?: Container[];
  selectedCategoryId?: number;
  selectedContainerId?: number | 'none';
  selectedStatus?: FilterStatus;
  minPrice?: string | number;
  maxPrice?: string | number;
} 