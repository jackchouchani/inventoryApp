import { FilterStatus } from '../hooks/useFilterBar';

export interface FilterBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onCategoryChange?: (categoryId: string | null) => void;
  onContainerChange?: (containerId: string | null) => void;
  onStatusChange?: (status: FilterStatus) => void;
  onPriceChange?: (min?: number, max?: number) => void;
} 