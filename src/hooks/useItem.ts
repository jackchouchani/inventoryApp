import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { fetchItemById } from '../store/itemsThunks';

export const useItem = (itemId: number | string | null) => {
  const dispatch = useDispatch<AppDispatch>();
  
  const selectedItem = useSelector((state: RootState) => state.items.selectedItem);
  const status = useSelector((state: RootState) => state.items.status);
  const error = useSelector((state: RootState) => state.items.error);
  
  // Vérifier si l'item est déjà en cache
  const cachedItem = useSelector((state: RootState) => 
    itemId ? state.items.entities[Number(itemId)] : null
  );

  useEffect(() => {
    if (itemId && !cachedItem) {
      dispatch(fetchItemById(Number(itemId)));
    } else if (cachedItem) {
    }
  }, [itemId, cachedItem, dispatch]);

  return {
    item: cachedItem || selectedItem,
    isLoading: status === 'loading',
    error,
    refetch: () => {
      if (itemId) {
        dispatch(fetchItemById(Number(itemId)));
      }
    }
  };
}; 