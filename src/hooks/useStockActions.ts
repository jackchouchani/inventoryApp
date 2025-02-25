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

  const handleMarkAsSold = useCallback(async (item: Item) => {
    try {
      if (!item) return;

      const now = new Date().toISOString();
      const updateData = {
        ...item,
        status: 'sold' as const,
        soldAt: now,
        updatedAt: now
      };

      dispatch(updateItemAction(updateData));

      try {
        await database.updateItem(item.id, updateData);
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.INVENTORY] });
      } catch (error) {
        dispatch(updateItemAction(item));
        handleError(error, 'Erreur lors du marquage comme vendu', {
          source: 'stock_actions',
          message: `Échec de la mise à jour de l'article ${item.id} comme vendu`,
          showAlert: true
        });
      }
    } catch (error) {
      handleError(error, 'Erreur lors de la mise à jour du stock', {
        source: 'stock_actions',
        message: `Erreur générale lors de la mise à jour de l'article ${item.id}`,
        showAlert: true
      });
    }
  }, [dispatch, queryClient]);

  const handleMarkAsAvailable = useCallback(async (item: Item) => {
    try {
      if (!item) return;

      const now = new Date().toISOString();
      const updateData = {
        ...item,
        status: 'available' as const,
        soldAt: undefined,
        updatedAt: now
      };

      dispatch(updateItemAction(updateData));

      try {
        await database.updateItem(item.id, updateData);
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.INVENTORY] });
      } catch (error) {
        dispatch(updateItemAction(item));
        handleError(error, 'Erreur lors de la remise en stock', {
          source: 'stock_actions',
          message: `Échec de la remise en stock de l'article ${item.id}`,
          showAlert: true
        });
      }
    } catch (error) {
      handleError(error, 'Erreur lors de la mise à jour du stock', {
        source: 'stock_actions',
        message: `Erreur générale lors de la remise en stock de l'article ${item.id}`,
        showAlert: true
      });
    }
  }, [dispatch, queryClient]);

  return {
    handleMarkAsSold,
    handleMarkAsAvailable
  };
} 