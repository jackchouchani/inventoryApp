import { createAsyncThunk } from '@reduxjs/toolkit';
import { Location } from '../types/location';
import { RootState } from './store';
import { supabase } from '../config/supabase';
import { handleDatabaseError } from '../utils/errorHandler';
import { ErrorTypeEnum, ErrorDetails } from '../utils/errorHandler';
import { PostgrestError } from '@supabase/supabase-js';
import { isOfflineMode } from '../utils/offlineUtils';
import { generateUniqueLocationQRCode } from '../utils/qrCodeGenerator';

// Types pour les réponses et erreurs
interface ThunkError {
  message: string;
  type: ErrorTypeEnum;
  originalError: unknown;
}

interface LocationInput {
  name: string;
  address?: string;
  description?: string;
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
 * Récupérer tous les emplacements
 */
export const fetchLocations = createAsyncThunk<
  Location[],
  void,
  { state: RootState; rejectValue: ThunkError }
>('locations/fetchLocations', async (_, { rejectWithValue }) => {
  try {
    // Vérifier si nous sommes en mode hors ligne (réseau OU forcé)
    if (isOfflineMode()) {
      console.log('[fetchLocations] Mode hors ligne détecté, récupération depuis IndexedDB');
      const { localDB } = await import('../database/localDatabase');
      
      // Récupérer les locations depuis IndexedDB
      const allLocalLocations = await localDB.locations
        .orderBy('name')
        .toArray();
      
      console.log(`[fetchLocations] Récupéré ${allLocalLocations.length} locations depuis IndexedDB`);
      
      // Conversion des types locaux vers les types standards
      return allLocalLocations.map(location => ({
        ...location,
        id: typeof location.id === 'string' ? parseInt(location.id) : location.id
      })) as Location[];
    }

    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('deleted', false)
      .order('name', { ascending: true });

    if (error) throw error;

    return data.map(location => ({
      id: location.id,
      name: location.name,
      address: location.address,
      description: location.description,
      qrCode: location.qr_code,
      createdAt: location.created_at,
      updatedAt: location.updated_at,
      deleted: location.deleted,
      userId: location.user_id
    }));
  } catch (error) {
    // Si c'est une erreur réseau, fallback vers IndexedDB
    if (error instanceof Error && 
        (error.message.includes('Failed to fetch') || 
         error.message.includes('NetworkError') ||
         error.message.includes('network error'))) {
      console.log('[fetchLocations] Erreur réseau, fallback vers IndexedDB');
      try {
        const { localDB } = await import('../database/localDatabase');
        
        const allLocalLocations = await localDB.locations
          .orderBy('name')
          .toArray();
        
        console.log(`[fetchLocations] Récupéré ${allLocalLocations.length} locations depuis IndexedDB (fallback réseau)`);
        // Conversion des types locaux vers les types standards pour le fallback aussi
        return allLocalLocations.map(location => ({
          ...location,
          id: typeof location.id === 'string' ? parseInt(location.id) : location.id
        })) as Location[];
      } catch (fallbackError) {
        console.error('[fetchLocations] Erreur IndexedDB fallback:', fallbackError);
        return [];
      }
    }
    return rejectWithValue(handleThunkError(error));
  }
});

/**
 * Récupérer un emplacement par son QR code
 */
export const fetchLocationByQRCode = createAsyncThunk<
  Location | null,
  string,
  { state: RootState; rejectValue: ThunkError }
>('locations/fetchLocationByQRCode', async (qrCode, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase
      .from('locations')
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
      name: data.name,
      address: data.address,
      description: data.description,
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
 * Créer un nouvel emplacement
 */
export const createLocation = createAsyncThunk<
  Location,
  LocationInput,
  { state: RootState; rejectValue: ThunkError }
>('locations/createLocation', async (locationInput, { rejectWithValue }) => {
  try {
    // Récupérer l'utilisateur actuel depuis Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw new Error('Utilisateur non authentifié');
    }

    // Générer le QR code unique au format LOC_XXXX
    const qrCode = await generateUniqueLocationQRCode();
    
    const { data, error } = await supabase
      .from('locations')
      .insert({
        name: locationInput.name,
        address: locationInput.address,
        description: locationInput.description,
        qr_code: qrCode,
        user_id: user.id, // ✅ AJOUT du user_id requis
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted: false
      })
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new Error('Erreur lors de la création de l\'emplacement');

    return {
      id: data.id,
      name: data.name,
      address: data.address,
      description: data.description,
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
 * Mettre à jour un emplacement
 */
export const updateLocation = createAsyncThunk<
  Location,
  { id: number; updates: Partial<LocationInput> },
  { state: RootState; rejectValue: ThunkError }
>('locations/updateLocation', async ({ id, updates }, { rejectWithValue }) => {
  try {
    const updateData: any = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('locations')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new Error('Emplacement non trouvé');

    return {
      id: data.id,
      name: data.name,
      address: data.address,
      description: data.description,
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
 * Supprimer un emplacement (soft delete)
 */
export const deleteLocation = createAsyncThunk<
  void,
  number,
  { state: RootState; rejectValue: ThunkError }
>('locations/deleteLocation', async (locationId, { rejectWithValue }) => {
  try {
    const { error } = await supabase
      .from('locations')
      .update({
        deleted: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', locationId);

    if (error) throw error;
  } catch (error) {
    return rejectWithValue(handleThunkError(error));
  }
});