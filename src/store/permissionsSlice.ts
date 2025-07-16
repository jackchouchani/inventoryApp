import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UserProfile } from '../types/permissions';
import { loadAllUsers, loadUserProfile, updateUserPermissions, updateUserProfile, inviteUser } from './permissionsThunks';

interface PermissionsState {
  users: UserProfile[];
  selectedUser: UserProfile | null;
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
}

const initialState: PermissionsState = {
  users: [],
  selectedUser: null,
  isLoading: false,
  isUpdating: false,
  error: null,
};

const permissionsSlice = createSlice({
  name: 'permissions',
  initialState,
  reducers: {
    // Sélectionner un utilisateur pour la gestion des permissions
    selectUser: (state, action: PayloadAction<UserProfile>) => {
      state.selectedUser = action.payload;
    },
    
    // Désélectionner l'utilisateur actuel
    clearSelectedUser: (state) => {
      state.selectedUser = null;
    },
    
    // Effacer les erreurs
    clearError: (state) => {
      state.error = null;
    },
    
    // Réinitialiser l'état de chargement (pour débloquer)
    resetLoadingState: (state) => {
      state.isLoading = false;
      state.isUpdating = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Charger tous les utilisateurs
    builder
      .addCase(loadAllUsers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadAllUsers.fulfilled, (state, action) => {
        state.isLoading = false;
        state.users = action.payload;
      })
      .addCase(loadAllUsers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Failed to load users';
      });

    // Charger un profil utilisateur spécifique
    builder
      .addCase(loadUserProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadUserProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedUser = action.payload;
        
        // Mettre à jour l'utilisateur dans la liste si présent
        const index = state.users.findIndex(user => user.id === action.payload.id);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
      })
      .addCase(loadUserProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Failed to load user profile';
      });

    // Mettre à jour les permissions d'un utilisateur
    builder
      .addCase(updateUserPermissions.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(updateUserPermissions.fulfilled, (state, action) => {
        state.isUpdating = false;
        
        // Mettre à jour l'utilisateur sélectionné
        if (state.selectedUser && state.selectedUser.id === action.payload.id) {
          state.selectedUser = action.payload;
        }
        
        // Mettre à jour l'utilisateur dans la liste
        const index = state.users.findIndex(user => user.id === action.payload.id);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
      })
      .addCase(updateUserPermissions.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload || 'Failed to update user permissions';
      });

    // Mettre à jour le profil complet d'un utilisateur (rôle + permissions)
    builder
      .addCase(updateUserProfile.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.isUpdating = false;
        
        // Mettre à jour l'utilisateur sélectionné
        if (state.selectedUser && state.selectedUser.id === action.payload.id) {
          state.selectedUser = action.payload;
        }
        
        // Mettre à jour l'utilisateur dans la liste
        const index = state.users.findIndex(user => user.id === action.payload.id);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload || 'Failed to update user profile';
      });

    // Inviter un utilisateur
    builder
      .addCase(inviteUser.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(inviteUser.fulfilled, (state, action) => {
        state.isUpdating = false;
        // Si l'invitation a réussi, on pourrait rafraîchir la liste des utilisateurs
        // ou afficher un message de succès
      })
      .addCase(inviteUser.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload || 'Failed to invite user';
      });
  },
});

export const { selectUser, clearSelectedUser, clearError, resetLoadingState } = permissionsSlice.actions;
export default permissionsSlice.reducer;