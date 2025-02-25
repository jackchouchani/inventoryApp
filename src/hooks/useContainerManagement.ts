import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import { Container } from '../types/container';
import { handleDatabaseError } from '../utils/errorHandler';
import { AuthError, PostgrestError } from '@supabase/supabase-js';
import { useRefreshStore } from '../store/refreshStore';

export const useContainerManagement = () => {
  const queryClient = useQueryClient();
  const triggerRefresh = useRefreshStore(state => state.triggerRefresh);

  const handleContainerSubmit = useCallback(async (containerData: Partial<Container>) => {
    try {
      console.log('Soumission du container:', containerData);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new AuthError('Utilisateur non connecté');

      const formattedData = {
        name: containerData.name,
        description: containerData.description || '',
        number: containerData.number || null,
        qr_code: containerData.qrCode || null,
        user_id: user.id,
        deleted: false,
        created_at: containerData.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      let resultContainer: Container | null = null;

      if (containerData.id) {
        console.log('Mise à jour du container existant:', containerData.id);
        const { error, data } = await supabase
          .from('containers')
          .update(formattedData)
          .eq('id', containerData.id)
          .select('*')
          .single();

        if (error) {
          console.error('Erreur lors de la mise à jour:', error);
          throw error;
        }

        if (data) {
          resultContainer = {
            id: data.id,
            name: data.name,
            description: data.description,
            number: data.number,
            qrCode: data.qr_code,
            createdAt: data.created_at,
            updatedAt: data.updated_at
          };
        }
      } else {
        console.log('Création d\'un nouveau container');
        const { error, data } = await supabase
          .from('containers')
          .insert(formattedData)
          .select('*')
          .single();

        if (error) {
          console.error('Erreur lors de la création:', error);
          throw error;
        }

        if (data) {
          resultContainer = {
            id: data.id,
            name: data.name,
            description: data.description,
            number: data.number,
            qrCode: data.qr_code,
            createdAt: data.created_at,
            updatedAt: data.updated_at
          };
        }
      }

      // Invalider le cache React Query
      await queryClient.invalidateQueries({ queryKey: ['containers'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      
      // Déclencher un rafraîchissement global
      triggerRefresh();
      
      console.log('Opération réussie');
      return { success: true, container: resultContainer };
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
      if (error instanceof Error || error instanceof PostgrestError) {
        handleDatabaseError(error);
      }
      return { success: false, container: null };
    }
  }, [queryClient, triggerRefresh]);

  return {
    handleContainerSubmit
  };
}; 