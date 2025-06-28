import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
import { createContainer, updateContainer, fetchContainers } from '../store/containersThunks';
import { Container } from '../types/container';
import { handleDatabaseError } from '../utils/errorHandler';

export const useContainerManagement = () => {
  const dispatch = useDispatch<AppDispatch>();

  const handleContainerSubmit = useCallback(async (containerData: Partial<Container>) => {
    try {
      console.log('Soumission du container:', containerData);
      
      let resultContainer: Container | null = null;

      if (containerData.id) {
        console.log('Mise à jour du container existant:', containerData.id);
        
        // ✅ UTILISER REDUX THUNK - Remplace database.updateContainer
        const result = await dispatch(updateContainer({
          id: containerData.id,
          updates: {
            name: containerData.name || '',
            description: containerData.description || '',
            ...(containerData.number !== null && containerData.number !== undefined && { number: containerData.number }),
            ...(containerData.locationId !== undefined && { locationId: containerData.locationId })
          }
        })).unwrap();
        
        resultContainer = result;
      } else {
        console.log('Création d\'un nouveau container');
        
        // ✅ UTILISER REDUX THUNK - Remplace database.addContainer
        const result = await dispatch(createContainer({
          name: containerData.name || '',
          description: containerData.description || '',
          number: containerData.number || 0,
          locationId: containerData.locationId || null
        })).unwrap();
        
        resultContainer = result;
      }

      // ✅ UTILISER REDUX THUNK - Remplace database.getContainers + dispatch manuel
      await dispatch(fetchContainers());
      
      console.log('Opération réussie');
      return { success: true, container: resultContainer };
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
      if (error instanceof Error) {
        handleDatabaseError(error);
      }
      return { success: false, container: null };
    }
  }, [dispatch]);

  return {
    handleContainerSubmit
  };
}; 