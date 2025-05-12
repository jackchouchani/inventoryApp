import React, { createContext, useContext, useState } from 'react';

// Créer un contexte pour préserver l'état de recherche Algolia
export function createSearchStateContext() {
  // Interface pour l'état de recherche
  interface SearchStateType {
    query: string;
    filters: Record<string, any>;
  }
  
  // État initial
  const initialState: SearchStateType = {
    query: '',
    filters: {}
  };

  // Contexte
  const SearchStateContext = createContext<{
    searchState: SearchStateType;
    setSearchState: React.Dispatch<React.SetStateAction<SearchStateType>>;
  }>({
    searchState: initialState,
    setSearchState: () => {}
  });

  // Provider qui préserve l'état de recherche
  const SearchStateProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
    const [searchState, setSearchState] = useState<SearchStateType>(initialState);
    
    return (
      <SearchStateContext.Provider value={{ searchState, setSearchState }}>
        {children}
      </SearchStateContext.Provider>
    );
  };

  // Hook pour utiliser l'état de recherche
  const useSearchStateContext = () => useContext(SearchStateContext);

  return {
    SearchStateProvider,
    useSearchStateContext
  };
} 