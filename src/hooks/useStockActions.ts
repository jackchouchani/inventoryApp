// Dans src/hooks/useStockActions.ts
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { database } from '../database/database';
import { handleError } from '../utils/errorHandler';
import type { Item } from '../types/item';
import { QUERY_KEYS } from '../constants/queryKeys';

export function useStockActions() {
  const queryClient = useQueryClient();

  const markItem = useCallback(async (
    itemId: number,
    updates: Partial<Item>,
    optimisticData: (oldItem: Item) => Item
  ) => {
    const previousData = queryClient.getQueryData<Item[]>([QUERY_KEYS.INVENTORY]) || [];

    // Mise à jour optimiste
    queryClient.setQueryData<Item[]>([QUERY_KEYS.INVENTORY], oldItems =>
      (oldItems || []).map(item =>
        item.id === itemId ? optimisticData(item) : item
      )
    );
    console.log('[DEBUG useStockActions] Mise à jour optimiste appliquée pour item:', itemId); // Log optimiste

    try {
      console.log('[DEBUG useStockActions] Envoi à database.updateItem:', { itemId, updates }); // Log avant l'appel API
      await database.updateItem(itemId, updates);
      console.log('[DEBUG useStockActions] database.updateItem SUCCESS pour item:', itemId); // Log succès API

      // Invalidation douce pour resynchronisation
      await queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.INVENTORY],
        refetchType: 'active',
      });
      console.log('[DEBUG useStockActions] Invalidation de requête déclenchée pour item:', itemId); // Log invalidation


      return true;
    } catch (error) {
      console.error('[DEBUG useStockActions] database.updateItem ERREUR pour item:', itemId, error); // Log erreur API
      // Rollback en cas d'erreur
      queryClient.setQueryData([QUERY_KEYS.INVENTORY], previousData);
      handleError(error, 'Erreur de mise à jour', { showAlert: true });
      return false;
    }
  }, [queryClient]);

  const handleMarkAsSold = useCallback(async (itemIdString: string, soldDate: string, salePrice?: number) => {
    const itemId = Number(itemIdString);
    if (isNaN(itemId)) {
      handleError(new Error('ID invalide'), 'ID d\'article invalide', { showAlert: true });
      return false;
    }

    const finalSalePrice = salePrice ?? 0;

    return markItem(
      itemId,
      {
        status: 'sold',
        soldAt: new Date(soldDate).toISOString(),
        sellingPrice: finalSalePrice
      },
      (oldItem) => ({
        ...oldItem,
        status: 'sold',
        soldAt: new Date(soldDate).toISOString(),
        sellingPrice: finalSalePrice
      })
    );
  }, [markItem]);

  const handleMarkAsAvailable = useCallback(async (itemIdString: string) => {
    const itemId = Number(itemIdString);
    if (isNaN(itemId)) {
      handleError(new Error('ID invalide'), 'ID d\'article invalide', { showAlert: true });
      return false;
    }

    return markItem(
      itemId,
      { status: 'available', soldAt: undefined },
      (oldItem) => ({ ...oldItem, status: 'available', soldAt: undefined })
    );
  }, [markItem]);

  const handleUpdateSellingPrice = useCallback(async (itemIdString: string, newSellingPrice: number) => {
    const itemId = Number(itemIdString);
    if (isNaN(itemId)) {
      handleError(new Error('ID invalide'), 'ID d\'article invalide', { showAlert: true });
      return false;
    }

    return markItem(
      itemId,
      { sellingPrice: newSellingPrice },
      (oldItem) => ({ ...oldItem, sellingPrice: newSellingPrice })
    );
  }, [markItem]);

  return {
    handleMarkAsSold,
    handleMarkAsAvailable,
    handleUpdateSellingPrice
  };
}