import { createAsyncThunk } from '@reduxjs/toolkit';
import { databaseInterface } from '../database/database';
import type { UserProfile, UserPermissionsUpdate, UserProfileUpdate, InviteUserRequest } from '../types/permissions';

// Charger tous les utilisateurs
export const loadAllUsers = createAsyncThunk<
  UserProfile[],
  void,
  { rejectValue: string }
>('permissions/loadAllUsers', async (_, { rejectWithValue }) => {
  try {
    const users = await databaseInterface.getAllUsers();
    return users;
  } catch (error) {
    console.error('[permissionsThunks] Erreur chargement utilisateurs:', error);
    return rejectWithValue(error instanceof Error ? error.message : 'Failed to load users');
  }
});

// Charger un profil utilisateur spécifique
export const loadUserProfile = createAsyncThunk<
  UserProfile,
  string,
  { rejectValue: string }
>('permissions/loadUserProfile', async (userId, { rejectWithValue }) => {
  try {
    console.log('[permissionsThunks] Loading user profile for:', userId);
    const profile = await databaseInterface.getUserProfile(userId);
    
    if (!profile) {
      throw new Error('User profile not found');
    }
    
    console.log('[permissionsThunks] User profile loaded:', profile);
    return profile;
  } catch (error) {
    console.error('[permissionsThunks] Error loading user profile:', error);
    return rejectWithValue(error instanceof Error ? error.message : 'Failed to load user profile');
  }
});

// Mettre à jour les permissions d'un utilisateur (version optimisée)
export const updateUserPermissions = createAsyncThunk<
  UserProfile,
  { userId: string; permissions: UserPermissionsUpdate; currentProfile: UserProfile },
  { rejectValue: string }
>('permissions/updateUserPermissions', async ({ userId, permissions, currentProfile }, { rejectWithValue }) => {
  try {
    console.log('[permissionsThunks] Starting update for user:', userId);
    
    // Mettre à jour les permissions dans la base de données
    console.log('[permissionsThunks] Updating permissions in database...');
    await databaseInterface.updateUserPermissions(userId, permissions);
    console.log('[permissionsThunks] Permissions updated successfully');
    
    // Retourner le profil mis à jour sans rechargement depuis la DB
    const updatedProfile: UserProfile = {
      ...currentProfile,
      permissions: permissions.permissions
    };
    
    console.log('[permissionsThunks] Returning updated profile:', updatedProfile);
    return updatedProfile;
  } catch (error) {
    console.error('[permissionsThunks] Erreur mise à jour permissions:', error);
    return rejectWithValue(error instanceof Error ? error.message : 'Failed to update user permissions');
  }
});

// Mettre à jour le profil utilisateur (rôle + permissions)
export const updateUserProfile = createAsyncThunk<
  UserProfile,
  { userId: string; profileUpdate: UserProfileUpdate },
  { rejectValue: string }
>('permissions/updateUserProfile', async ({ userId, profileUpdate }, { rejectWithValue }) => {
  try {
    console.log('[permissionsThunks] Updating user profile for user:', userId, profileUpdate);
    
    // Mettre à jour le profil dans la base de données
    await databaseInterface.updateUserProfile(userId, profileUpdate);
    
    // Recharger le profil utilisateur mis à jour
    const updatedProfile = await databaseInterface.getUserProfile(userId);
    
    if (!updatedProfile) {
      throw new Error('Failed to reload updated user profile');
    }
    
    console.log('[permissionsThunks] User profile updated successfully:', userId);
    return updatedProfile;
  } catch (error) {
    console.error('[permissionsThunks] Error updating user profile:', error);
    return rejectWithValue(error instanceof Error ? error.message : 'Failed to update user profile');
  }
});

// Inviter un nouvel utilisateur
export const inviteUser = createAsyncThunk<
  { success: boolean; message: string },
  InviteUserRequest,
  { rejectValue: string }
>('permissions/inviteUser', async (inviteRequest, { rejectWithValue }) => {
  try {
    console.log('[permissionsThunks] Inviting user:', inviteRequest.email, 'with role:', inviteRequest.role);
    
    // Envoyer l'invitation via la base de données
    const result = await databaseInterface.inviteUser(inviteRequest);
    
    console.log('[permissionsThunks] Invitation result:', result);
    return result;
  } catch (error) {
    console.error('[permissionsThunks] Error inviting user:', error);
    return rejectWithValue(error instanceof Error ? error.message : 'Failed to invite user');
  }
});