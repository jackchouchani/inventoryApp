import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import { Container } from '../types/container';
import { handleDatabaseError } from '../utils/errorHandler';
import { AuthError, PostgrestError } from '@supabase/supabase-js';

export const useContainerManagement = () => {
  const queryClient = useQueryClient();

  const handleContainerSubmit = useCallback(async (containerData: Partial<Container>) => {
    try {
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (containerData.id) {
        const { error } = await supabase
          .from('containers')
          .update(formattedData)
          .eq('id', containerData.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('containers')
          .insert(formattedData);

        if (error) throw error;
      }

      // Invalider le cache React Query
      await queryClient.invalidateQueries({ queryKey: ['containers'] });
      return true;
    } catch (error) {
      if (error instanceof Error || error instanceof PostgrestError) {
        handleDatabaseError(error);
      }
      return false;
    }
  }, [queryClient]);

  return {
    handleContainerSubmit
  };
}; 