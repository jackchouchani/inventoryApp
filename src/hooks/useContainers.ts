import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { setContainers, setStatus } from '../store/containersSlice';
import { database } from '../database/database';

export const useContainers = () => {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Sélecteur de base pour les entities
  const containersEntities = useSelector((state: RootState) => state.containers.entities);
  const containersStatus = useSelector((state: RootState) => state.containers.status);
  
  // Mémoriser le calcul des containers pour éviter les re-renders
  const containers = useMemo(() => 
    Object.values(containersEntities || {}).filter(Boolean), 
    [containersEntities]
  );

  // Charger les containers seulement si le statut est 'idle'
  useEffect(() => {
    if (containersStatus === 'idle') {
      const loadContainers = async () => {
        try {
          setIsLoading(true);
          setError(null);
          dispatch(setStatus('loading'));
          const loadedContainers = await database.getContainers();
          dispatch(setContainers(loadedContainers));
          dispatch(setStatus('succeeded'));
        } catch (error) {
          console.error('Erreur lors du chargement des containers:', error);
          setError('Erreur lors du chargement des containers');
          dispatch(setStatus('failed'));
        } finally {
          setIsLoading(false);
        }
      };
      loadContainers();
    } else {
      setIsLoading(containersStatus === 'loading');
    }
  }, [containersStatus, dispatch]);

  const refetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      dispatch(setStatus('loading'));
      const loadedContainers = await database.getContainers();
      dispatch(setContainers(loadedContainers));
      dispatch(setStatus('succeeded'));
    } catch (error) {
      console.error('Erreur lors du chargement des containers:', error);
      setError('Erreur lors du chargement des containers');
      dispatch(setStatus('failed'));
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  return {
    data: containers,
    isLoading,
    error,
    refetch
  };
}; 