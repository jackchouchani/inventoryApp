import { useState, useCallback, useEffect } from 'react';

/**
 * Hook pour gérer une recherche avec debounce
 * @param initialValue Valeur initiale de la recherche
 * @param delay Délai en ms avant de mettre à jour la valeur finale
 */
export const useSearchDebounce = (initialValue: string = '', delay: number = 300) => {
  const [searchQuery, setSearchQuery] = useState<string>(initialValue);
  const [debouncedValue, setDebouncedValue] = useState<string>(initialValue);

  // Fonction de debounce
  const debouncedSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
    },
    []
  );

  // Effet pour mettre à jour la valeur debouncée
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(searchQuery);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery, delay]);

  return {
    searchQuery,
    setSearchQuery,
    debouncedValue,
    debouncedSearch
  };
};

export default useSearchDebounce; 