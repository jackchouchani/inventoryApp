import { useState, useEffect } from 'react';
import { ConflictDetector } from '../services/ConflictDetector';
import { ConflictRecord } from '../database/localDatabase';

export const useUnresolvedConflictsCount = () => {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadConflictsCount = async () => {
      try {
        const conflictDetector = ConflictDetector.getInstance();
        const conflicts = await conflictDetector.getUnresolvedConflicts();
        setCount(conflicts.length);
      } catch (error) {
        console.warn('Erreur lors du chargement des conflits:', error);
        setCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    loadConflictsCount();

    // Recharger périodiquement (toutes les 30 secondes)
    const interval = setInterval(loadConflictsCount, 30000);

    return () => clearInterval(interval);
  }, []);

  return { count, isLoading };
};

export const useConflicts = () => {
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadConflicts = async () => {
    try {
      setIsLoading(true);
      const conflictDetector = ConflictDetector.getInstance();
      const allConflicts = await conflictDetector.getUnresolvedConflicts();
      setConflicts(allConflicts);
    } catch (error) {
      console.warn('Erreur lors du chargement des conflits:', error);
      setConflicts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConflicts();
  }, []);

  return { 
    conflicts, 
    isLoading, 
    reload: loadConflicts,
    count: conflicts.length 
  };
};