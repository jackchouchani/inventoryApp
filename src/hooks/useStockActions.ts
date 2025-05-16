import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { database } from '../database/database';
import { updateItem as updateItemAction } from '../store/itemsActions';
import { handleError } from '../utils/errorHandler';
import type { Item } from '../types/item';
import { QUERY_KEYS } from '../constants/queryKeys';

export function useStockActions() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  const handleMarkAsSold = useCallback(async (itemIdString: string, soldDate: string, newSellingPrice?: number) => {
    console.log('[useStockActions] handleMarkAsSold called with:', { itemIdString, soldDate, newSellingPrice });
    try {
      const itemId = parseInt(itemIdString, 10);
      if (isNaN(itemId)) {
        const error = new Error('Invalid item ID');
        console.error('[useStockActions] Invalid item ID:', itemIdString, error);
        handleError(error, 'ID d\'article invalide', { showAlert: true });
        return false;
      }

      let validSoldDate = null;
      try {
        validSoldDate = new Date(soldDate).toISOString();
        console.log('[useStockActions] Validated soldDate:', validSoldDate);
      } catch (dateError) {
        console.error('[useStockActions] Invalid date format:', soldDate, dateError);
        handleError(new Error('Format de date invalide'), 'Format de date invalide', { showAlert: true });
        return false;
      }

      const now = new Date().toISOString();
      
      const updateData: any = {
        status: 'sold',
        sold_at: validSoldDate,
        updated_at: now
      };

      if (newSellingPrice !== undefined && !isNaN(newSellingPrice)) {
        updateData.selling_price = newSellingPrice;
        console.log('[useStockActions] Adding selling_price to updateData:', newSellingPrice);
      }

      console.log('[useStockActions] updateData prepared:', JSON.stringify(updateData));

      try {
        console.log('[useStockActions] Calling database.updateItem with ID:', itemId, 'and data:', JSON.stringify(updateData));
        
        await database.updateItem(itemId, {
          status: 'sold',
          soldAt: validSoldDate,
          sellingPrice: newSellingPrice
        });
        
        console.log('[useStockActions] database.updateItem successful.');
        
        console.log('[useStockActions] Invalidating query cache for', QUERY_KEYS.INVENTORY);
        await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.INVENTORY] });
        console.log('[useStockActions] Cache invalidated.');
        
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log('[useStockActions] Mark as sold completed successfully for item:', itemId);
        
        return true;

      } catch (error) {
        console.error('[useStockActions] Error during database update:', error);
        handleError(error, 'Erreur lors du marquage comme vendu', {
          source: 'stock_actions',
          message: `Échec de la mise à jour de l'article ${itemIdString} comme vendu`,
          showAlert: true
        });
        return false;
      }
    } catch (error) {
      console.error('[useStockActions] General error in handleMarkAsSold:', error);
      handleError(error, 'Erreur lors de la mise à jour du stock', {
        source: 'stock_actions',
        message: `Erreur générale lors de la mise à jour de l'article ${itemIdString}`,
        showAlert: true
      });
      return false;
    }
  }, [dispatch, queryClient]);

  const handleMarkAsAvailable = useCallback(async (itemIdString: string) => {
    try {
      const itemId = parseInt(itemIdString, 10);
      if (isNaN(itemId)) {
        handleError(new Error('Invalid item ID'), 'ID d\'article invalide pour remise en stock');
        return;
      }
      const now = new Date().toISOString();
      const updateData = {
        status: 'available' as const,
        soldAt: undefined,
        updatedAt: now
      };

      try {
        await database.updateItem(itemId, updateData);
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.INVENTORY] });
      } catch (error) {
        handleError(error, 'Erreur lors de la remise en stock', {
          source: 'stock_actions',
          message: `Échec de la remise en stock de l'article ${itemIdString}`,
          showAlert: true
        });
      }
    } catch (error) {
      handleError(error, 'Erreur lors de la mise à jour du stock', {
        source: 'stock_actions',
        message: `Erreur générale lors de la remise en stock de l'article ${itemIdString}`,
        showAlert: true
      });
    }
  }, [dispatch, queryClient]);

  return {
    handleMarkAsSold,
    handleMarkAsAvailable
  };
} 