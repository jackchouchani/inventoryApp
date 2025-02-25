import { useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectAllCategories } from '../store/categorySlice';
import { selectAllContainers } from '../store/containersSlice';

export type FilterStatus = 'all' | 'available' | 'sold';

export interface UseFilterBarProps {
  onCategoryChange?: (categoryId: number | undefined) => void;
  onContainerChange?: (containerId: number | 'none' | undefined) => void;
  onStatusChange?: (status: FilterStatus) => void;
  onPriceChange?: (min: number | undefined, max: number | undefined) => void;
}

export const useFilterBar = ({
  onCategoryChange,
  onContainerChange,
  onStatusChange,
  onPriceChange,
}: UseFilterBarProps) => {
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const [selectedContainer, setSelectedContainer] = useState<number | 'none' | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<FilterStatus>('all');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  const categories = useSelector(selectAllCategories);
  const containers = useSelector(selectAllContainers);

  const handleCategorySelect = useCallback((categoryId: number) => {
    const newValue = selectedCategory === categoryId ? undefined : categoryId;
    setSelectedCategory(newValue);
    onCategoryChange?.(newValue);
  }, [selectedCategory, onCategoryChange]);

  const handleContainerSelect = useCallback((containerId: number) => {
    const newValue = selectedContainer === containerId ? undefined : containerId;
    setSelectedContainer(newValue);
    onContainerChange?.(newValue);
  }, [selectedContainer, onContainerChange]);

  const handleStatusChange = useCallback((status: FilterStatus) => {
    setSelectedStatus(status);
    onStatusChange?.(status);
  }, [onStatusChange]);

  const handlePriceChange = useCallback((
    type: 'min' | 'max',
    value: string
  ) => {
    if (type === 'min') {
      setMinPrice(value);
    } else {
      setMaxPrice(value);
    }
    
    const min = type === 'min' ? (value ? parseFloat(value) : undefined) : (minPrice ? parseFloat(minPrice) : undefined);
    const max = type === 'max' ? (value ? parseFloat(value) : undefined) : (maxPrice ? parseFloat(maxPrice) : undefined);
    
    onPriceChange?.(min, max);
  }, [minPrice, maxPrice, onPriceChange]);

  return {
    showFilters,
    setShowFilters,
    selectedCategory,
    selectedContainer,
    selectedStatus,
    minPrice,
    maxPrice,
    categories,
    containers,
    handleCategorySelect,
    handleContainerSelect,
    handleStatusChange,
    handlePriceChange,
  };
}; 