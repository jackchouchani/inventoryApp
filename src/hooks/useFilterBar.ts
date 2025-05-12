import { useState, useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectAllCategories } from '../store/categorySlice';
import { selectAllContainers } from '../store/containersSlice';

export type FilterStatus = 'all' | 'available' | 'sold';

export interface UseFilterBarProps {
  onCategoryChange?: (categoryId: number | undefined) => void;
  onContainerChange?: (containerId: number | 'none' | undefined) => void;
  onStatusChange?: (status: FilterStatus) => void;
  onPriceChange?: (min: number | undefined, max: number | undefined) => void;
  initialCategory?: number;
  initialContainer?: number | 'none';
  initialStatus?: FilterStatus;
  initialMinPrice?: string;
  initialMaxPrice?: string;
}

export const useFilterBar = ({
  onCategoryChange,
  onContainerChange,
  onStatusChange,
  onPriceChange,
  initialCategory,
  initialContainer,
  initialStatus = 'all',
  initialMinPrice = '',
  initialMaxPrice = '',
}: UseFilterBarProps) => {
  // Utiliser useRef pour suivre si c'est le premier rendu
  const isInitialMount = useRef(true);
  
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(initialCategory);
  const [selectedContainer, setSelectedContainer] = useState<number | 'none' | undefined>(initialContainer);
  const [selectedStatus, setSelectedStatus] = useState<FilterStatus>(initialStatus);
  const [minPrice, setMinPrice] = useState<string>(initialMinPrice);
  const [maxPrice, setMaxPrice] = useState<string>(initialMaxPrice);

  const categories = useSelector(selectAllCategories);
  const containers = useSelector(selectAllContainers);

  // Synchroniser les états avec les props initiales seulement au premier rendu
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      
      if (initialCategory !== undefined) {
        setSelectedCategory(initialCategory);
      }
      
      if (initialContainer !== undefined) {
        setSelectedContainer(initialContainer);
      }
      
      if (initialStatus !== undefined) {
        setSelectedStatus(initialStatus);
      }
      
      if (initialMinPrice !== undefined) {
        setMinPrice(initialMinPrice);
      }
      
      if (initialMaxPrice !== undefined) {
        setMaxPrice(initialMaxPrice);
      }
    }
  }, [initialCategory, initialContainer, initialStatus, initialMinPrice, initialMaxPrice]);

  const handleCategorySelect = useCallback((categoryId: number) => {
    const newValue = selectedCategory === categoryId ? undefined : categoryId;
    setSelectedCategory(newValue);
    
    // Appeler le callback immédiatement pour éviter les problèmes de synchronisation
    if (onCategoryChange) {
      onCategoryChange(newValue);
    }
  }, [selectedCategory, onCategoryChange]);

  const handleContainerSelect = useCallback((containerId: number) => {
    const newValue = selectedContainer === containerId ? undefined : containerId;
    setSelectedContainer(newValue);
    
    // Appeler le callback immédiatement
    if (onContainerChange) {
      onContainerChange(newValue);
    }
  }, [selectedContainer, onContainerChange]);

  const handleStatusChange = useCallback((status: FilterStatus) => {
    setSelectedStatus(status);
    
    // Appeler le callback immédiatement
    if (onStatusChange) {
      onStatusChange(status);
    }
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
    
    // Appeler le callback immédiatement
    if (onPriceChange) {
      onPriceChange(min, max);
    }
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