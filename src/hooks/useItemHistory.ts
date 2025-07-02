import { useState, useEffect, useCallback } from 'react';
import { databaseInterface } from '../database/database';
import type { ItemHistory } from '../types/itemHistory';

interface UseItemHistoryReturn {
  history: ItemHistory[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useItemHistory = (itemId: number): UseItemHistoryReturn => {
  const [history, setHistory] = useState<ItemHistory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!itemId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await databaseInterface.getItemHistory(itemId);
      setHistory(data);
    } catch (e: any) {
      setError(e.message || 'Une erreur est survenue lors de la récupération de l\'historique.');
    } finally {
      setIsLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, isLoading, error, refetch: fetchHistory };
};