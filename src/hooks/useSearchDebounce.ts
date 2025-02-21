import { useState, useEffect } from 'react';

export const useSearchDebounce = (delay = 300) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedValue, setDebouncedValue] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(searchQuery);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery, delay]);

  return {
    searchQuery,
    setSearchQuery,
    debouncedValue
  };
}; 