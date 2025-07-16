import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { selectAllContainers } from '../store/containersSlice';
import { fetchContainers, fetchContainerByQRCode, createContainer, updateContainer, deleteContainer } from '../store/containersThunks';

interface ContainerInput {
  name: string;
  description?: string;
  number: number;
}

/**
 * Hook optimisé pour gérer les containers avec Redux
 * Remplace useContainers.ts avec accès direct à la database
 */
export const useContainersOptimized = () => {
  const dispatch = useDispatch<AppDispatch>();
  const containers = useSelector(selectAllContainers);
  const status = useSelector((state: RootState) => state.containers.status);
  const error = useSelector((state: RootState) => state.containers.error);

  // Chargement automatique si nécessaire
  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchContainers());
    }
  }, [dispatch, status]);

  // Actions optimisées
  const actions = {
    // Rafraîchir les containers
    refetch: useCallback(async () => {
      return dispatch(fetchContainers()).unwrap();
    }, [dispatch]),

    // Rechercher par QR code
    findByQRCode: useCallback(async (qrCode: string) => {
      return dispatch(fetchContainerByQRCode(qrCode)).unwrap();
    }, [dispatch]),

    // Créer un container
    create: useCallback(async (containerData: ContainerInput) => {
      return dispatch(createContainer(containerData)).unwrap();
    }, [dispatch]),

    // Mettre à jour un container
    update: useCallback(async (id: number, updates: Partial<ContainerInput>) => {
      return dispatch(updateContainer({ id, updates })).unwrap();
    }, [dispatch]),

    // Supprimer un container
    delete: useCallback(async (containerId: number) => {
      return dispatch(deleteContainer(containerId)).unwrap();
    }, [dispatch])
  };

  return {
    // Données - utiliser 'data' pour compatibilité avec l'ancien hook
    data: containers,
    containers,
    
    // États
    isLoading: status === 'loading',
    error,
    
    // Actions
    ...actions
  };
}; 