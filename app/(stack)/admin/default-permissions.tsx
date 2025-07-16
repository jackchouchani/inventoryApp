import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Switch } from 'react-native-paper';

import { CommonHeader } from '../../../src/components';
import { useUserPermissions } from '../../../src/hooks/useUserPermissions';
import { useAppTheme } from '../../../src/contexts/ThemeContext';
import StyleFactory from '../../../src/styles/StyleFactory';

import type { AppPermissions, UserProfile } from '../../../src/types/permissions';
import { database } from '../../../src/database/database';

interface DefaultPermissionsState {
  ADMIN: AppPermissions;
  MANAGER: AppPermissions;
  OPERATOR: AppPermissions;
}

export default function DefaultPermissionsScreen() {
  const router = useRouter();
  const { activeTheme } = useAppTheme();
  const userPermissions = useUserPermissions();
  
  const [defaultPermissions, setDefaultPermissions] = useState<DefaultPermissionsState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserProfile['role']>('ADMIN');
  const [showResetModal, setShowResetModal] = useState(false);
  
  const styles = StyleFactory.getThemedStyles(activeTheme, 'Settings');

  useEffect(() => {
    // Vérifier si l'utilisateur est admin
    if (!userPermissions.isAdmin) {
      router.push('/(stack)/settings');
      return;
    }
    
    loadDefaultPermissions();
  }, [userPermissions.isAdmin, router]);

  const loadDefaultPermissions = async () => {
    try {
      setIsLoading(true);
      
      const [adminPerms, managerPerms, operatorPerms] = await Promise.all([
        database.getDefaultPermissionsForRole('ADMIN'),
        database.getDefaultPermissionsForRole('MANAGER'),
        database.getDefaultPermissionsForRole('OPERATOR')
      ]);
      
      setDefaultPermissions({
        ADMIN: adminPerms,
        MANAGER: managerPerms,
        OPERATOR: operatorPerms
      });
    } catch (error) {
      console.error('[DefaultPermissions] Erreur lors du chargement des permissions par défaut:', error);
      Alert.alert('Erreur', 'Impossible de charger les permissions par défaut.');
    } finally {
      setIsLoading(false);
    }
  };

  const updatePermission = async (role: UserProfile['role'], section: string, action: string, value: boolean) => {
    if (!defaultPermissions) return;
    
    try {
      setIsUpdating(true);
      
      // Mise à jour optimiste de l'interface
      const updatedPermissions = {
        ...defaultPermissions,
        [role]: {
          ...defaultPermissions[role],
          [section]: {
            ...defaultPermissions[role][section as keyof AppPermissions],
            [action]: value
          }
        }
      };
      
      setDefaultPermissions(updatedPermissions);
      
      // Mise à jour en base de données
      await database.updateDefaultPermissionsForRole(role, updatedPermissions[role]);
    } catch (error) {
      console.error('[DefaultPermissions] Erreur lors de la mise à jour:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour les permissions par défaut.');
      
      // Restaurer l'état précédent en cas d'erreur
      await loadDefaultPermissions();
    } finally {
      setIsUpdating(false);
    }
  };

  const resetToHardcodedDefaults = async () => {
    setShowResetModal(true);
  };

  const handleConfirmReset = async () => {
    setShowResetModal(false);
    
    try {
      setIsUpdating(true);
      
      // Réinitialiser avec les permissions par défaut codées en dur
      await database.resetDefaultPermissionsToHardcoded();
      
      // Recharger les permissions
      await loadDefaultPermissions();
      
      // Afficher un message de succès simple
      console.log('Permissions par défaut réinitialisées avec succès');
    } catch (error) {
      console.error('[DefaultPermissions] Erreur lors de la réinitialisation:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const renderPermissionSwitch = useCallback((
    role: UserProfile['role'],
    section: string,
    action: string,
    label: string,
    description?: string
  ) => {
    if (!defaultPermissions) return null;
    
    const sectionPermissions = defaultPermissions[role][section as keyof AppPermissions];
    const isEnabled = sectionPermissions?.[action as keyof typeof sectionPermissions] === true;
    
    return (
      <View key={`${role}.${section}.${action}`} style={styles.permissionRow}>
        <View style={styles.permissionInfo}>
          <Text style={styles.permissionLabel}>{label}</Text>
          {description && (
            <Text style={styles.permissionDescription}>{description}</Text>
          )}
        </View>
        <Switch
          value={isEnabled}
          onValueChange={(value) => updatePermission(role, section, action, value)}
          disabled={isUpdating}
          accessibilityLabel={`${label} - ${isEnabled ? 'Activé' : 'Désactivé'}`}
        />
      </View>
    );
  }, [defaultPermissions, isUpdating]);

  const renderPermissionSection = useCallback((title: string, children: React.ReactNode) => (
    <View style={styles.permissionSection}>
      <Text style={styles.permissionSectionTitle}>{title}</Text>
      {children}
    </View>
  ), []);

  const renderRolePermissions = useCallback((role: UserProfile['role']) => (
    <ScrollView style={styles.container}>
      {renderPermissionSection('Gestion des Articles', (
        <>
          {renderPermissionSwitch(role, 'items', 'create', 'Créer des articles')}
          {renderPermissionSwitch(role, 'items', 'update', 'Modifier des articles')}
          {renderPermissionSwitch(role, 'items', 'delete', 'Supprimer des articles')}
        </>
      ))}
      
      {renderPermissionSection('Gestion des Catégories', (
        <>
          {renderPermissionSwitch(role, 'categories', 'create', 'Créer des catégories')}
          {renderPermissionSwitch(role, 'categories', 'update', 'Modifier des catégories')}
          {renderPermissionSwitch(role, 'categories', 'delete', 'Supprimer des catégories')}
        </>
      ))}
      
      {renderPermissionSection('Gestion des Contenants', (
        <>
          {renderPermissionSwitch(role, 'containers', 'create', 'Créer des contenants')}
          {renderPermissionSwitch(role, 'containers', 'update', 'Modifier des contenants')}
          {renderPermissionSwitch(role, 'containers', 'delete', 'Supprimer des contenants')}
        </>
      ))}
      
      {renderPermissionSection('Fonctionnalités', (
        <>
          {renderPermissionSwitch(role, 'features', 'scanner', 'Accès au Scanner')}
          {renderPermissionSwitch(role, 'features', 'locations', 'Accès aux Emplacements')}
          {renderPermissionSwitch(role, 'features', 'sources', 'Accès aux Sources')}
          {renderPermissionSwitch(role, 'features', 'invoices', 'Accès aux Factures')}
          {renderPermissionSwitch(role, 'features', 'auditLog', 'Accès au Journal d\'audit')}
          {renderPermissionSwitch(role, 'features', 'labels', 'Accès aux Étiquettes')}
          {renderPermissionSwitch(role, 'features', 'dashboard', 'Accès au Tableau de Bord')}
        </>
      ))}
      
      {renderPermissionSection('Données Sensibles', (
        <>
          {renderPermissionSwitch(role, 'stats', 'viewPurchasePrice', 'Voir les prix d\'achat')}
        </>
      ))}
      
      {renderPermissionSection('Administration', (
        <>
          {renderPermissionSwitch(role, 'settings', 'canManageUsers', 'Gérer les utilisateurs')}
        </>
      ))}
    </ScrollView>
  ), [renderPermissionSection, renderPermissionSwitch]);

  const getRoleLabel = (role: UserProfile['role']) => {
    switch (role) {
      case 'ADMIN':
        return 'Administrateur';
      case 'MANAGER':
        return 'Gestionnaire';
      case 'OPERATOR':
        return 'Opérateur';
      default:
        return role;
    }
  };

  const getRoleColor = (role: UserProfile['role']) => {
    switch (role) {
      case 'ADMIN':
        return '#e74c3c'; // Rouge
      case 'MANAGER':
        return '#f39c12'; // Orange
      case 'OPERATOR':
        return '#3498db'; // Bleu
      default:
        return '#95a5a6'; // Gris
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <CommonHeader
          title="Permissions par défaut"
          onBackPress={() => router.back()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={activeTheme.primary} />
          <Text style={styles.loadingText}>Chargement des permissions par défaut...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CommonHeader
        title="Permissions par défaut"
        onBackPress={() => router.back()}
      />
      
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Configuration des Permissions par Défaut</Text>
        <Text style={styles.sectionDescription}>
          Modifiez les permissions par défaut qui seront appliquées lors de la création d'un nouvel utilisateur ou lors de l'utilisation du bouton "Permissions par défaut".
        </Text>
        
        {isUpdating && (
          <View style={styles.updatingBanner}>
            <ActivityIndicator size="small" color={activeTheme.primary} />
            <Text style={styles.updatingText}>Mise à jour en cours...</Text>
          </View>
        )}
        
        {/* Sélecteur de rôle */}
        <View style={styles.roleSelector}>
          {(['ADMIN', 'MANAGER', 'OPERATOR'] as const).map(role => (
            <TouchableOpacity
              key={role}
              style={[
                styles.roleTab,
                selectedRole === role && styles.roleTabActive,
                { backgroundColor: selectedRole === role ? getRoleColor(role) : 'transparent' }
              ]}
              onPress={() => setSelectedRole(role)}
            >
              <Text style={[
                styles.roleTabText,
                selectedRole === role && styles.roleTabTextActive
              ]}>
                {getRoleLabel(role)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Bouton de réinitialisation */}
        <TouchableOpacity
          style={[styles.inviteButton, { backgroundColor: activeTheme.error, marginBottom: 16 }]}
          onPress={resetToHardcodedDefaults}
          disabled={isUpdating}
        >
          <Text style={styles.inviteButtonText}>
            🔄 Réinitialiser toutes les permissions par défaut
          </Text>
        </TouchableOpacity>
        
        {/* Permissions pour le rôle sélectionné */}
        {defaultPermissions && renderRolePermissions(selectedRole)}
      </View>
      
      {/* Modal de confirmation pour la réinitialisation */}
      <Modal
        visible={showResetModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowResetModal(false)}
        accessibilityViewIsModal={true}
      >
        <View style={styles.modalOverlay} accessible={false}>
          <View style={styles.modalContent} accessible={true}>
            <Text style={styles.modalTitle}>Confirmer l'action</Text>
            
            <Text style={[styles.sectionDescription, { marginVertical: 16, textAlign: 'center' }]}>
              Êtes-vous sûr de vouloir réinitialiser toutes les permissions par défaut aux valeurs d'origine ?
            </Text>
            
            <Text style={[styles.sectionDescription, { marginBottom: 24, textAlign: 'center', fontWeight: '600', color: activeTheme.error }]}>
              Cette action est irréversible et écrasera toutes vos personnalisations.
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowResetModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalConfirmButton, { backgroundColor: activeTheme.error }]}
                onPress={handleConfirmReset}
                disabled={isUpdating}
              >
                <Text style={[styles.modalConfirmButtonText, { color: '#fff' }]}>
                  {isUpdating ? 'Réinitialisation...' : 'Réinitialiser'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}