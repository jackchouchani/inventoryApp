import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { selectAllLocations } from '../store/locationsSlice';
import { fetchLocations, fetchLocationByQRCode, createLocation, updateLocation, deleteLocation } from '../store/locationsThunks';

interface LocationInput {
  name: string;
  address?: string;
  description?: string;
}

/**
 * Hook pour gérer les emplacements avec Redux
 */
export const useLocations = () => {
  const dispatch = useDispatch<AppDispatch>();
  const locations = useSelector(selectAllLocations);
  const status = useSelector((state: RootState) => state.locations.status);
  const error = useSelector((state: RootState) => state.locations.error);

  // Chargement automatique si nécessaire
  useEffect(() => {
    console.log('[useLocations] Status:', status, 'Locations count:', locations.length);
    if (status === 'idle') {
      console.log('[useLocations] Dispatching fetchLocations...');
      dispatch(fetchLocations());
    }
  }, [dispatch, status, locations.length]);

  // Actions
  const actions = {
    // Rafraîchir les emplacements
    refetch: useCallback(async () => {
      return dispatch(fetchLocations()).unwrap();
    }, [dispatch]),

    // Rechercher par QR code
    findByQRCode: useCallback(async (qrCode: string) => {
      return dispatch(fetchLocationByQRCode(qrCode)).unwrap();
    }, [dispatch]),

    // Créer un emplacement
    create: useCallback(async (locationData: LocationInput) => {
      return dispatch(createLocation(locationData)).unwrap();
    }, [dispatch]),

    // Mettre à jour un emplacement
    update: useCallback(async (id: number, updates: Partial<LocationInput>) => {
      return dispatch(updateLocation({ id, updates })).unwrap();
    }, [dispatch]),

    // Supprimer un emplacement
    delete: useCallback(async (locationId: number) => {
      return dispatch(deleteLocation(locationId)).unwrap();
    }, [dispatch])
  };

  return {
    // Données
    data: locations,
    locations,
    
    // États
    isLoading: status === 'loading',
    error,
    
    // Actions
    ...actions
  };
};