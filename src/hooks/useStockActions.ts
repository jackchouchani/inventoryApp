// Dans src/hooks/useStockActions.ts
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { updateItemStatus, sellItem, moveItem } from '../store/itemsThunks';
import { AppDispatch } from '../store/store';
import { handleError } from '../utils/errorHandler';

export function useStockActions() {
  const dispatch = useDispatch<AppDispatch>();

  const handleMarkAsSold = useCallback(async (itemIdString: string, soldDate: string, salePrice?: number) => {
    const itemId = Number(itemIdString);
    if (isNaN(itemId)) {
      handleError(new Error('ID invalide'), 'ID d\'article invalide', { showAlert: true });
      return false;
    }

    const finalSalePrice = salePrice ?? 0;
    console.log('[DEBUG useStockActions] Envoi Redux sellItem:', { itemId, soldDate, salePrice: finalSalePrice }); 

    try {
      // Utiliser le nouveau thunk sellItem qui gère prix et date
      const result = await dispatch(sellItem({ 
        itemId, 
        soldDate,
        salePrice: finalSalePrice
      })).unwrap();
      
      console.log('[DEBUG useStockActions] Redux sellItem SUCCESS pour item:', itemId, result);
      return true;
    } catch (error) {
      console.error('[DEBUG useStockActions] Redux sellItem ERREUR pour item:', itemId, error);
      handleError(error, 'Erreur de mise à jour', { showAlert: true });
      return false;
    }
  }, [dispatch]);

  const handleMarkAsAvailable = useCallback(async (itemIdString: string) => {
    const itemId = Number(itemIdString);
    if (isNaN(itemId)) {
      handleError(new Error('ID invalide'), 'ID d\'article invalide', { showAlert: true });
      return false;
    }

    console.log('[DEBUG useStockActions] Envoi Redux updateItemStatus:', { itemId, status: 'available' });

    try {
      const result = await dispatch(updateItemStatus({ 
        itemId, 
        status: 'available' 
      })).unwrap();
      
      console.log('[DEBUG useStockActions] Redux updateItemStatus SUCCESS pour item:', itemId, result);
      console.log('[DEBUG useStockActions] Prix dans le résultat:', result.sellingPrice);
      
      // Petit délai pour laisser Redux propager la mise à jour
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return true;
    } catch (error) {
      console.error('[DEBUG useStockActions] Redux updateItemStatus ERREUR pour item:', itemId, error);
      handleError(error, 'Erreur de mise à jour', { showAlert: true });
      return false;
    }
  }, [dispatch]);

  const handleUpdateSellingPrice = useCallback(async (itemIdString: string, newSellingPrice: number) => {
    const itemId = Number(itemIdString);
    if (isNaN(itemId)) {
      handleError(new Error('ID invalide'), 'ID d\'article invalide', { showAlert: true });
      return false;
    }

    console.log('[DEBUG useStockActions] Mise à jour prix via Redux thunk pour item:', itemId, newSellingPrice);
    
    try {
      // ✅ UTILISER REDUX THUNK - Remplace database.updateItem + fetchItemById
      const { updateItem } = await import('../store/itemsThunks');
      await dispatch(updateItem({
        id: itemId,
        updates: { sellingPrice: newSellingPrice }
      })).unwrap();
      
      console.log('[DEBUG useStockActions] Mise à jour prix SUCCESS pour item:', itemId);
      return true;
    } catch (error) {
      console.error('[DEBUG useStockActions] Mise à jour prix ERREUR pour item:', itemId, error);
      handleError(error, 'Erreur de mise à jour du prix', { showAlert: true });
      return false;
    }
  }, [dispatch]);

  const handleMoveItem = useCallback(async (itemIdString: string, containerId: number | null) => {
    const itemId = Number(itemIdString);
    if (isNaN(itemId)) {
      handleError(new Error('ID invalide'), 'ID d\'article invalide', { showAlert: true });
      return false;
    }

    console.log('[DEBUG useStockActions] Envoi Redux moveItem:', { itemId, containerId });

    try {
      const result = await dispatch(moveItem({ 
        itemId, 
        containerId 
      })).unwrap();
      
      console.log('[DEBUG useStockActions] Redux moveItem SUCCESS pour item:', itemId, result);
      return true;
    } catch (error) {
      console.error('[DEBUG useStockActions] Redux moveItem ERREUR pour item:', itemId, error);
      handleError(error, 'Erreur de déplacement', { showAlert: true });
      return false;
    }
  }, [dispatch]);

  return {
    handleMarkAsSold,
    handleMarkAsAvailable,
    handleUpdateSellingPrice,
    handleMoveItem
  };
}