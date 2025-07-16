import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Switch } from 'react-native-paper';


import { CommonHeader } from '../../../src/components';
import { useUserPermissions } from '../../../src/hooks/useUserPermissions';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useAppTheme } from '../../../src/contexts/ThemeContext';
import StyleFactory from '../../../src/styles/StyleFactory';

import { AppDispatch } from '../../../src/store/store';
import { 
  loadAllUsers, 
  updateUserPermissions as updatePermissionsThunk,
  updateUserProfile,
  inviteUser
} from '../../../src/store/permissionsThunks';
import { 
  selectUser,
  clearSelectedUser,
  resetLoadingState
} from '../../../src/store/permissionsSlice';
import { 
  selectAllUsers, 
  selectSelectedUser, 
  selectPermissionsLoading,
  selectPermissionsUpdating,
  selectPermissionsError
} from '../../../src/store/selectors';

import type { UserProfile, AppPermissions } from '../../../src/types/permissions';
import { applyDefaultPermissionsForRole, getRoleLabel, getRoleColor } from '../../../src/utils/permissionsUtils';
import { forceLog } from '../../../src/utils/debugUtils';
import { supabase } from '../../../src/config/supabase';

export default function PermissionsScreen() {
  
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { activeTheme } = useAppTheme();
  const userPermissions = useUserPermissions();
  const { user: currentUser, updateCurrentUser } = useAuth();
  
  
  // État Redux
  const users = useSelector(selectAllUsers);
  const selectedUser = useSelector(selectSelectedUser);
  const isLoading = useSelector(selectPermissionsLoading);
  const isUpdating = useSelector(selectPermissionsUpdating);
  const error = useSelector(selectPermissionsError);
  
  
  
  // État local
  const [showUserList, setShowUserList] = useState(true);
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserProfile['role']>('OPERATOR');
  
  const styles = StyleFactory.getThemedStyles(activeTheme, 'Settings');
  
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isStuck, setIsStuck] = useState(false);
  const [updateTimeout, setUpdateTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [lastActivity, setLastActivity] = useState(Date.now());
  
  // Timeout de sécurité pour détecter les chargements bloqués - Version moins agressive
  useEffect(() => {
    if (isLoading && !isStuck && !hasLoadedOnce) {
      const timeoutId = setTimeout(() => {
        console.warn('[Permissions] Timeout détecté - chargement bloqué');
        setIsStuck(true);
      }, 30000); // 30 secondes et seulement si jamais chargé
      
      return () => clearTimeout(timeoutId);
    }
  }, [isLoading, isStuck, hasLoadedOnce]);
  
  // Détection d'état incohérent : on a des utilisateurs mais isLoading=true
  useEffect(() => {
    if (isLoading && users.length > 0 && !isStuck && !isUpdating) {
      console.warn('[Permissions] État incohérent détecté - correction automatique');
      dispatch(resetLoadingState());
    }
  }, [isLoading, users.length, isStuck, isUpdating, dispatch]);

  // Timeout automatique pour débloquer isUpdating
  useEffect(() => {
    if (isUpdating && !updateTimeout) {
      const timeoutId = setTimeout(() => {
        console.warn('[Permissions] isUpdating timeout - déblocage automatique');
        dispatch(resetLoadingState());
        setUpdateTimeout(null);
      }, 10000); // 10 secondes
      
      setUpdateTimeout(timeoutId);
    } else if (!isUpdating && updateTimeout) {
      clearTimeout(updateTimeout);
      setUpdateTimeout(null);
    }
  }, [isUpdating, updateTimeout, dispatch]);

  // Surveillance de l'activité et refresh préventif de la session
  useEffect(() => {
    const checkSessionHealth = async () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;
      
      // Si l'utilisateur est inactif depuis plus de 30 secondes
      if (timeSinceLastActivity > 30000) {
        console.log('[Permissions] Inactivity detected, refreshing session...');
        
        try {
          // Refresh de la session Supabase
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) throw error;
          
          if (session) {
            console.log('[Permissions] Session refreshed successfully');
          } else {
            console.warn('[Permissions] No session found during refresh');
          }
        } catch (error) {
          console.error('[Permissions] Session refresh failed:', error);
        }
        
        // Mettre à jour le timestamp d'activité
        setLastActivity(now);
      }
    };
    
    // Vérifier la santé de la session toutes les 15 secondes
    const interval = setInterval(checkSessionHealth, 15000);
    
    return () => clearInterval(interval);
  }, [lastActivity]);

  // Mettre à jour l'activité lors des interactions utilisateur
  const updateActivity = useCallback(() => {
    setLastActivity(Date.now());
  }, []);
  
  useEffect(() => {
    // Vérifier si l'utilisateur est admin
    if (!userPermissions.isAdmin) {
      router.push('/(stack)/settings');
      return;
    }
    
    // Charger les utilisateurs seulement une fois
    if (!hasLoadedOnce && !isLoading) {
      setHasLoadedOnce(true);
      dispatch(loadAllUsers());
    }
  }, [userPermissions.isAdmin, hasLoadedOnce, isLoading, dispatch, router]);
  
  const handleSelectUser = (user: UserProfile) => {
    dispatch(selectUser(user));
    setShowUserList(false);
  };
  
  const handleBackToUserList = () => {
    dispatch(clearSelectedUser());
    setShowUserList(true);
  };
  
  const handlePermissionToggle = useCallback(async (section: string, action: string, value: boolean) => {
    // Mettre à jour l'activité utilisateur
    updateActivity();
    
    console.log('[handlePermissionToggle] START - selectedUser:', !!selectedUser, 'isUpdating:', isUpdating, 'isStuck:', isStuck);
    
    if (!selectedUser) {
      console.log('[handlePermissionToggle] No selected user, aborting');
      return;
    }
    
    if (isUpdating) {
      console.log('[handlePermissionToggle] Already updating, aborting');
      return;
    }
    
    if (isStuck) {
      console.log('[handlePermissionToggle] System is stuck, aborting');
      return;
    }
    
    // Optimisation : créer les nouvelles permissions de manière plus efficace
    const newPermissions = {
      ...selectedUser.permissions,
      [section]: {
        ...selectedUser.permissions[section as keyof AppPermissions],
        [action]: value
      }
    };
    
    console.log('[handlePermissionToggle] New permissions:', newPermissions);
    
    const updatedUser = { ...selectedUser, permissions: newPermissions };
    
    // Mise à jour optimiste immédiate (synchrone)
    dispatch(selectUser(updatedUser));
    console.log('[handlePermissionToggle] Optimistic update applied');
    
    // Mise à jour en arrière-plan avec retry automatique
    try {
      console.log('[handlePermissionToggle] Starting backend update for user:', selectedUser.id);
      
      let updatedProfile;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
        try {
          updatedProfile = await dispatch(updatePermissionsThunk({
            userId: selectedUser.id,
            permissions: { permissions: newPermissions },
            currentProfile: selectedUser
          })).unwrap();
          
          console.log('[handlePermissionToggle] Backend update successful on attempt:', retryCount + 1);
          break;
        } catch (error) {
          retryCount++;
          console.log(`[handlePermissionToggle] Attempt ${retryCount} failed:`, error);
          
          if (retryCount > maxRetries) {
            throw error;
          }
          
          // Attendre avant de réessayer
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          console.log(`[handlePermissionToggle] Retrying attempt ${retryCount + 1}...`);
        }
      }
      
      console.log('[handlePermissionToggle] Backend update successful:', updatedProfile);
      
      // Vérifier que les permissions ont été réellement sauvegardées
      if (JSON.stringify(updatedProfile.permissions) !== JSON.stringify(newPermissions)) {
        console.warn('[handlePermissionToggle] WARNING: Saved permissions differ from expected!');
        console.warn('[handlePermissionToggle] Expected:', newPermissions);
        console.warn('[handlePermissionToggle] Actual:', updatedProfile.permissions);
      }
      
      // Mettre à jour le contexte si nécessaire
      if (currentUser && selectedUser.id === currentUser.id) {
        updateCurrentUser(updatedProfile);
        console.log('[handlePermissionToggle] Current user context updated');
      }
    } catch (error) {
      console.error('[handlePermissionToggle] Backend update failed after retries:', error);
      // Restaurer l'état précédent en cas d'erreur
      dispatch(selectUser(selectedUser));
    }
  }, [selectedUser, isUpdating, isStuck, dispatch, currentUser, updateCurrentUser, updateActivity]);
  
  const handleRoleChange = async (newRole: UserProfile['role']) => {
    if (!selectedUser) return;
    
    try {
      const updatedProfile = await dispatch(updateUserProfile({
        userId: selectedUser.id,
        profileUpdate: { role: newRole }
      })).unwrap();
      
      // Si l'utilisateur modifié est l'utilisateur actuel, mettre à jour le contexte Auth
      if (currentUser && selectedUser.id === currentUser.id) {
        console.log('[Permissions] Mise à jour du rôle de l\'utilisateur actuel');
        updateCurrentUser(updatedProfile);
      }
      
      setShowRoleSelector(false);
      Alert.alert('Succès', `Rôle mis à jour vers ${getRoleLabel(newRole)}`);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du rôle:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le rôle. Veuillez réessayer.');
    }
  };
  
  const handleApplyDefaultPermissions = async () => {
    console.log('[handleApplyDefaultPermissions] Button clicked!');
    
    if (!selectedUser) {
      console.log('[handleApplyDefaultPermissions] No selected user!');
      return;
    }
    
    console.log('[handleApplyDefaultPermissions] Selected user:', selectedUser);
    console.log('[handleApplyDefaultPermissions] User role:', selectedUser.role);
    
    Alert.alert(
      'Confirmer l\'action',
      `Appliquer les permissions par défaut pour le rôle ${getRoleLabel(selectedUser.role)} ?\n\nCela remplacera toutes les permissions personnalisées actuelles.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: async () => {
            console.log('[handleApplyDefaultPermissions] User confirmed action');
            
            const defaultPermissions = applyDefaultPermissionsForRole(selectedUser.role);
            console.log('[handleApplyDefaultPermissions] Default permissions calculated:', defaultPermissions);
            
            try {
              console.log('[handleApplyDefaultPermissions] Starting permission update...');
              
              // Mise à jour optimiste de l'interface
              const updatedUser = { ...selectedUser, permissions: defaultPermissions };
              dispatch(selectUser(updatedUser));
              console.log('[handleApplyDefaultPermissions] Optimistic update applied');
              
              const updatedProfile = await dispatch(updatePermissionsThunk({
                userId: selectedUser.id,
                permissions: { permissions: defaultPermissions },
                currentProfile: selectedUser
              })).unwrap();
              
              console.log('[handleApplyDefaultPermissions] Backend update successful:', updatedProfile);
              
              if (currentUser && selectedUser.id === currentUser.id) {
                updateCurrentUser(updatedProfile);
                console.log('[handleApplyDefaultPermissions] Current user context updated');
              }
              
              Alert.alert('Succès', 'Permissions par défaut appliquées');
            } catch (error) {
              console.error('[handleApplyDefaultPermissions] Error:', error);
              Alert.alert('Erreur', 'Impossible d\'appliquer les permissions par défaut.');
              // Restaurer l'état précédent en cas d'erreur
              dispatch(selectUser(selectedUser));
            }
          }
        }
      ]
    );
  };
  
  const handleSendInvitation = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir une adresse email.');
      return;
    }
    
    try {
      const result = await dispatch(inviteUser({
        email: inviteEmail.trim(),
        role: inviteRole
      })).unwrap();
      
      if (result.success) {
        Alert.alert('Succès', result.message);
        setInviteEmail('');
        setInviteRole('OPERATOR');
        setShowInviteModal(false);
        // Recharger la liste des utilisateurs
        dispatch(loadAllUsers());
      } else {
        Alert.alert('Erreur', result.message);
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'invitation:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer l\'invitation. Veuillez réessayer.');
    }
  };
  
  const handleForceReload = () => {
    // Réinitialiser TOUT l'état
    dispatch(resetLoadingState());
    setHasLoadedOnce(false);
    setIsStuck(false);
    
    // Forcer le nouveau chargement
    dispatch(loadAllUsers());
  };
  
  const handleForceUnstuck = () => {
    console.log('[handleForceUnstuck] Forcing unstuck state');
    dispatch(resetLoadingState());
  };

  const handleCompleteReset = () => {
    console.log('[handleCompleteReset] Resetting everything');
    // Réinitialiser tous les états
    dispatch(resetLoadingState());
    dispatch(clearSelectedUser());
    setHasLoadedOnce(false);
    setIsStuck(false);
    setShowUserList(true);
    
    // Nettoyer les timeouts
    if (updateTimeout) {
      clearTimeout(updateTimeout);
      setUpdateTimeout(null);
    }
    
    // Forcer le rechargement
    setTimeout(() => {
      dispatch(loadAllUsers());
    }, 100);
  };
  
  const renderUserList = () => (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>Gestion des Permissions Utilisateur</Text>
      <Text style={styles.sectionDescription}>
        Sélectionnez un utilisateur pour gérer ses permissions
      </Text>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={activeTheme.primary} />
          <Text style={styles.loadingText}>
            {isStuck ? 'Chargement bloqué...' : 'Chargement des utilisateurs...'}
          </Text>
          {isStuck && (
            <View style={{ marginTop: 16, flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.inviteButton, { backgroundColor: activeTheme.warning }]}
                onPress={handleForceReload}
              >
                <Text style={styles.inviteButtonText}>🔄 Réessayer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inviteButton, { backgroundColor: activeTheme.error }]}
                onPress={handleCompleteReset}
              >
                <Text style={styles.inviteButtonText}>🔥 Reset complet</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.userList}>
          {users.map(user => (
            <TouchableOpacity
              key={user.id}
              style={styles.userCard}
              onPress={() => handleSelectUser(user)}
            >
              <View style={styles.userInfo}>
                <Text style={styles.userEmail}>{user.email}</Text>
                <View style={styles.roleContainer}>
                  <View 
                    style={[
                      styles.roleBadge, 
                      { backgroundColor: getRoleColor(user.role) }
                    ]}
                  >
                    <Text style={styles.roleBadgeText}>{getRoleLabel(user.role)}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.userActions}>
                <TouchableOpacity
                  style={styles.manageButton}
                  onPress={() => handleSelectUser(user)}
                >
                  <Text style={styles.manageButtonText}>Gérer</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity
            style={styles.inviteButton}
            onPress={() => setShowInviteModal(true)}
          >
            <Text style={styles.inviteButtonText}>✉️ Inviter un utilisateur</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={[styles.inviteButton, { marginTop: 16, backgroundColor: activeTheme.error }]}
            onPress={handleCompleteReset}
          >
            <Text style={styles.inviteButtonText}>🔥 Reset complet</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
  
  const renderPermissionSwitch = (
    section: string,
    action: string,
    label: string,
    description?: string
  ) => {
    if (!selectedUser) return null;
    
    const sectionPermissions = selectedUser.permissions[section as keyof AppPermissions];
    const isEnabled = sectionPermissions?.[action as keyof typeof sectionPermissions] === true;
    
    return (
      <View key={`${section}.${action}`} style={styles.permissionRow}>
        <View style={styles.permissionInfo}>
          <Text style={styles.permissionLabel}>{label}</Text>
          {description && (
            <Text style={styles.permissionDescription}>{description}</Text>
          )}
        </View>
        <Switch
          value={isEnabled}
          onValueChange={(value) => handlePermissionToggle(section, action, value)}
          disabled={isUpdating}
          accessibilityLabel={`${label} - ${isEnabled ? 'Activé' : 'Désactivé'}`}
          accessibilityHint={`Touchez pour ${isEnabled ? 'désactiver' : 'activer'} ${label}`}
        />
      </View>
    );
  };
  
  const renderPermissionSection = (title: string, children: React.ReactNode) => (
    <View style={styles.permissionSection}>
      <Text style={styles.permissionSectionTitle}>{title}</Text>
      {children}
    </View>
  );
  
  const renderPermissionsPanel = () => (
    <ScrollView style={styles.container}>
      <View style={styles.selectedUserHeader}>
        <View style={styles.userMainInfo}>
          <View style={styles.userInfoSection}>
            <Text style={styles.selectedUserEmail}>{selectedUser?.email}</Text>
          </View>
          
          <View style={styles.roleSection}>
            <TouchableOpacity 
              style={styles.roleSelector}
              onPress={() => setShowRoleSelector(true)}
            >
              <View 
                style={[
                  styles.roleBadge, 
                  { backgroundColor: selectedUser ? getRoleColor(selectedUser.role) : '#ccc' }
                ]}
              >
                <Text style={styles.roleBadgeText}>
                  {selectedUser ? getRoleLabel(selectedUser.role) : 'N/A'}
                </Text>
              </View>
              <Text style={styles.changeRoleText}>Modifier</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.defaultPermissionsButton}
              onPress={handleApplyDefaultPermissions}
            >
              <Text style={styles.defaultPermissionsButtonText}>
                📋 Permissions par défaut
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      {isUpdating && (
        <View style={styles.updatingBanner}>
          <ActivityIndicator size="small" color={activeTheme.primary} />
          <Text style={styles.updatingText}>Mise à jour des permissions...</Text>
          <TouchableOpacity
            style={[styles.inviteButton, { marginLeft: 10, backgroundColor: activeTheme.warning }]}
            onPress={handleForceUnstuck}
          >
            <Text style={styles.inviteButtonText}>🔓 Débloquer</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {renderPermissionSection('Gestion des Articles', (
        <>
          {renderPermissionSwitch('items', 'create', 'Créer des articles')}
          {renderPermissionSwitch('items', 'update', 'Modifier des articles')}
          {renderPermissionSwitch('items', 'delete', 'Supprimer des articles')}
        </>
      ))}
      
      {renderPermissionSection('Gestion des Catégories', (
        <>
          {renderPermissionSwitch('categories', 'create', 'Créer des catégories')}
          {renderPermissionSwitch('categories', 'update', 'Modifier des catégories')}
          {renderPermissionSwitch('categories', 'delete', 'Supprimer des catégories')}
        </>
      ))}
      
      {renderPermissionSection('Gestion des Contenants', (
        <>
          {renderPermissionSwitch('containers', 'create', 'Créer des contenants')}
          {renderPermissionSwitch('containers', 'update', 'Modifier des contenants')}
          {renderPermissionSwitch('containers', 'delete', 'Supprimer des contenants')}
        </>
      ))}
      
      {renderPermissionSection('Fonctionnalités', (
        <>
          {renderPermissionSwitch('features', 'scanner', 'Accès au Scanner')}
          {renderPermissionSwitch('features', 'locations', 'Accès aux Emplacements')}
          {renderPermissionSwitch('features', 'sources', 'Accès aux Sources')}
          {renderPermissionSwitch('features', 'invoices', 'Accès aux Factures')}
          {renderPermissionSwitch('features', 'auditLog', 'Accès au Journal d\'audit')}
          {renderPermissionSwitch('features', 'labels', 'Accès aux Étiquettes')}
          {renderPermissionSwitch('features', 'dashboard', 'Accès au Tableau de Bord')}
        </>
      ))}
      
      {renderPermissionSection('Données Sensibles', (
        <>
          {renderPermissionSwitch('stats', 'viewPurchasePrice', 'Voir les prix d\'achat')}
        </>
      ))}
      
      {renderPermissionSection('Administration', (
        <>
          {renderPermissionSwitch('settings', 'canManageUsers', 'Gérer les utilisateurs')}
        </>
      ))}
    </ScrollView>
  );
  
  return (
    <View style={styles.container}>
      <CommonHeader
        title={showUserList ? 'Permissions' : `Permissions - ${selectedUser?.email}`}
        onBackPress={showUserList ? () => router.push('/(stack)/settings') : handleBackToUserList}
      />
      
      {showUserList ? renderUserList() : renderPermissionsPanel()}
      
      {/* Modal de sélection de rôle */}
      <Modal
        visible={showRoleSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRoleSelector(false)}
        accessibilityViewIsModal={true}
      >
        <View style={styles.modalOverlay} accessible={false}>
          <View style={styles.modalContent} accessible={true}>
            <Text style={styles.modalTitle}>Changer le rôle</Text>
            
            {(['ADMIN', 'MANAGER', 'OPERATOR'] as const).map(role => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.roleOption,
                  selectedUser?.role === role && styles.roleOptionSelected
                ]}
                onPress={() => handleRoleChange(role)}
              >
                <View 
                  style={[
                    styles.roleBadge, 
                    { backgroundColor: getRoleColor(role) }
                  ]}
                >
                  <Text style={styles.roleBadgeText}>{getRoleLabel(role)}</Text>
                </View>
                {selectedUser?.role === role && (
                  <Text style={[styles.changeRoleText, { marginLeft: 'auto' }]}>✓ Actuel</Text>
                )}
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowRoleSelector(false)}
            >
              <Text style={styles.modalCancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* Modal d'invitation */}
      <Modal
        visible={showInviteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowInviteModal(false)}
        accessibilityViewIsModal={true}
      >
        <View style={styles.modalOverlay} accessible={false}>
          <View style={styles.modalContent} accessible={true}>
            <Text style={styles.modalTitle}>Inviter un utilisateur</Text>
            
            <TextInput
              style={styles.emailInput}
              placeholder="Adresse email"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <Text style={styles.roleLabel}>Rôle à attribuer :</Text>
            
            {(['ADMIN', 'MANAGER', 'OPERATOR'] as const).map(role => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.roleOption,
                  inviteRole === role && styles.roleOptionSelected
                ]}
                onPress={() => setInviteRole(role)}
              >
                <View 
                  style={[
                    styles.roleBadge, 
                    { backgroundColor: getRoleColor(role) }
                  ]}
                >
                  <Text style={styles.roleBadgeText}>{getRoleLabel(role)}</Text>
                </View>
              </TouchableOpacity>
            ))}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowInviteModal(false);
                  setInviteEmail('');
                  setInviteRole('OPERATOR');
                }}
              >
                <Text style={styles.modalCancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  !inviteEmail.trim() && styles.modalConfirmButtonDisabled
                ]}
                onPress={handleSendInvitation}
                disabled={!inviteEmail.trim() || isUpdating}
              >
                <Text style={styles.modalConfirmButtonText}>
                  {isUpdating ? 'Envoi...' : 'Envoyer l\'invitation'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}