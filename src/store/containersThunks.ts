import { createAsyncThunk } from '@reduxjs/toolkit';
import { Container } from '../types/container';
import { RootState } from './store';
import { supabase } from '../config/supabase';
import { handleDatabaseError } from '../utils/errorHandler';
import { ErrorTypeEnum, ErrorDetails } from '../utils/errorHandler';
import { PostgrestError } from '@supabase/supabase-js';
import { generateUniqueContainerQRCode } from '../utils/qrCodeGenerator';

// Types pour les réponses et erreurs
interface ThunkError {
  message: string;
  type: ErrorTypeEnum;
  originalError: unknown;
}

interface ContainerInput {
  name: string;
  description?: string;
  number: number;
}

// Fonction utilitaire pour convertir ErrorDetails en ThunkError
const convertToThunkError = (error: ErrorDetails): ThunkError => ({
  message: error.message,
  type: error.type,
  originalError: error.originalError || error
});

// Fonction utilitaire pour gérer les erreurs
const handleThunkError = (error: unknown): ThunkError => {
  const errorDetails = handleDatabaseError(
    error instanceof Error || (error && typeof error === 'object' && 'code' in error)
      ? (error as Error | PostgrestError)
      : new Error('Une erreur inconnue est survenue')
  );
  return convertToThunkError(errorDetails);
};

/**
 * Récupérer tous les containers
 */
export const fetchContainers = createAsyncThunk<
  Container[],
  void,
  { state: RootState; rejectValue: ThunkError }
>('containers/fetchContainers', async (_, { rejectWithValue }) => {
  try {
    console.log('[fetchContainers] Début du chargement des containers...');

    const { data, error } = await supabase
      .from('containers')
      .select('*')
      .eq('deleted', false)
      .order('number', { ascending: true });

    console.log('[fetchContainers] Résultat query:', { data: data?.length, error });

    if (error) throw error;

    return data.map(container => ({
      id: container.id,
      number: container.number,
      name: container.name,
      description: container.description || '',
      qrCode: container.qr_code,
      createdAt: container.created_at,
      updatedAt: container.updated_at,
      deleted: container.deleted,
      userId: container.user_id
    }));
  } catch (error) {
    return rejectWithValue(handleThunkError(error));
  }
});

/**
 * Récupérer un container par son QR code
 */
export const fetchContainerByQRCode = createAsyncThunk<
  Container | null,
  string,
  { state: RootState; rejectValue: ThunkError }
>('containers/fetchContainerByQRCode', async (qrCode, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase
      .from('containers')
      .select('*')
      .eq('qr_code', qrCode)
      .eq('deleted', false)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows returned
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      number: data.number,
      name: data.name,
      description: data.description || '',
      qrCode: data.qr_code,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      deleted: data.deleted,
      userId: data.user_id
    };
  } catch (error) {
    return rejectWithValue(handleThunkError(error));
  }
});

/**
 * Créer un nouveau container
 */
export const createContainer = createAsyncThunk<
  Container,
  ContainerInput,
  { state: RootState; rejectValue: ThunkError }
>('containers/createContainer', async (containerInput, { rejectWithValue }) => {
  try {
    // Récupérer l'utilisateur actuel depuis Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw new Error('Utilisateur non authentifié');
    }

    // Générer le QR code unique au format CONT_XXXX
    const qrCode = await generateUniqueContainerQRCode();
    
    const { data, error } = await supabase
      .from('containers')
      .insert({
        name: containerInput.name,
        description: containerInput.description || '',
        number: containerInput.number,
        qr_code: qrCode,
        user_id: user.id, // ✅ AJOUT du user_id requis
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted: false
      })
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new Error('Erreur lors de la création du container');

    return {
      id: data.id,
      number: data.number,
      name: data.name,
      description: data.description || '',
      qrCode: data.qr_code,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      deleted: data.deleted,
      userId: data.user_id
    };
  } catch (error) {
    return rejectWithValue(handleThunkError(error));
  }
});

/**
 * Mettre à jour un container
 */
export const updateContainer = createAsyncThunk<
  Container,
  { id: number; updates: Partial<ContainerInput> },
  { state: RootState; rejectValue: ThunkError }
>('containers/updateContainer', async ({ id, updates }, { rejectWithValue }) => {
  try {
    const updateData: any = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    // Générer un nouveau QR code unique si le numéro change
    if (updates.number !== undefined) {
      updateData.qr_code = await generateUniqueContainerQRCode();
    }

    const { data, error } = await supabase
      .from('containers')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new Error('Container non trouvé');

    return {
      id: data.id,
      number: data.number,
      name: data.name,
      description: data.description || '',
      qrCode: data.qr_code,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      deleted: data.deleted,
      userId: data.user_id
    };
  } catch (error) {
    return rejectWithValue(handleThunkError(error));
  }
});

/**
 * Supprimer un container (soft delete)
 */
export const deleteContainer = createAsyncThunk<
  void,
  number,
  { state: RootState; rejectValue: ThunkError }
>('containers/deleteContainer', async (containerId, { rejectWithValue }) => {
  try {
    const { error } = await supabase
      .from('containers')
      .update({
        deleted: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', containerId);

    if (error) throw error;
  } catch (error) {
    return rejectWithValue(handleThunkError(error));
  }
}); 