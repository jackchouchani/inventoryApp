import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
import { database } from '../database/database';
import { setContainers } from '../store/containersSlice';
import { Container } from '../types/container';
import { handleDatabaseError } from '../utils/errorHandler';
import { PostgrestError } from '@supabase/supabase-js';

export const useContainerManagement = () => {
  const dispatch = useDispatch<AppDispatch>();

  const handleContainerSubmit = useCallback(async (containerData: Partial<Container>) => {
    try {
      console.log('Soumission du container:', containerData);
      
      let resultContainer: Container | null = null;

      if (containerData.id) {
        console.log('Mise à jour du container existant:', containerData.id);
        // Utiliser le service database pour la mise à jour
        const updateData: any = {
          name: containerData.name || '',
          description: containerData.description || ''
        };
        
        // Ajouter number seulement s'il est fourni
        if (containerData.number !== null && containerData.number !== undefined) {
          updateData.number = containerData.number;
        }
        
        await database.updateContainer(containerData.id, updateData);
      } else {
        console.log('Création d\'un nouveau container');
        // Pour la création, utiliser un nombre par défaut si non fourni
        const createData: any = {
          name: containerData.name || '',
          description: containerData.description || '',
          number: containerData.number || 0 // Valeur par défaut
        };
        
        await database.addContainer(createData);
      }

      // Recharger tous les containers depuis la base et mettre à jour Redux
      const allContainers = await database.getContainers();
      dispatch(setContainers(allContainers));

      // Trouver le container qui vient d'être créé/modifié pour le retourner
      if (containerData.id) {
        resultContainer = allContainers.find(c => c.id === containerData.id) || null;
      } else {
        // Pour un nouveau container, prendre le dernier créé avec le même nom
        resultContainer = allContainers
          .filter(c => c.name === containerData.name)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
      }
      
      console.log('Opération réussie');
      return { success: true, container: resultContainer };
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
      if (error instanceof Error || error instanceof PostgrestError) {
        handleDatabaseError(error);
      }
      return { success: false, container: null };
    }
  }, [dispatch]);

  return {
    handleContainerSubmit
  };
}; 