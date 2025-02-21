import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, ActivityIndicator, Platform, Modal, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { database, createContainer, createItem } from '../../src/database/database';
import { useRefreshStore } from '../../src/store/refreshStore';
import { useAuth } from '../../src/contexts/AuthContext';
import { selectAllCategories } from '../../src/store/categorySlice';
import { useQueryClient } from '@tanstack/react-query';
import PerformanceDashboard from '../../src/components/PerformanceDashboard';
import { handleError } from '../../src/utils/errorHandler';
import { theme } from '../../src/utils/theme';
import * as Sentry from '@sentry/react-native';

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal = React.memo<ConfirmationModalProps>(({ visible, title, message, onConfirm, onCancel }) => (
  <Modal
    animationType="fade"
    transparent={true}
    visible={visible}
    onRequestClose={onCancel}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>{title}</Text>
        <Text style={styles.modalMessage}>{message}</Text>
        <View style={styles.modalButtons}>
          <Pressable 
            style={[styles.modalButton, styles.cancelButton]} 
            onPress={onCancel}
            accessibilityLabel="Annuler"
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </Pressable>
          <Pressable 
            style={[styles.modalButton, styles.confirmButton]} 
            onPress={onConfirm}
            accessibilityLabel="Confirmer"
          >
            <Text style={styles.confirmButtonText}>Confirmer</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>
));

ConfirmationModal.displayName = 'ConfirmationModal';

interface UIState {
  isResetModalVisible: boolean;
  showPerformance: boolean;
  isLoading: boolean;
}

const SettingsScreen = () => {
  const router = useRouter();
  const triggerRefresh = useRefreshStore(state => state.triggerRefresh);
  const categories = useSelector(selectAllCategories);
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const [uiState, setUiState] = useState<UIState>({
    isResetModalVisible: false,
    showPerformance: false,
    isLoading: false
  });

  const handleLogout = useCallback(async () => {
    try {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'User initiated logout',
        level: 'info'
      });
      
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      handleError(error, 'Erreur lors de la déconnexion');
      Sentry.captureException(error, {
        tags: { action: 'logout' }
      });
    }
  }, [signOut, router]);

  const performReset = useCallback(async () => {
    try {
      setUiState(prev => ({ ...prev, isLoading: true }));
      
      Sentry.addBreadcrumb({
        category: 'database',
        message: 'Database reset initiated',
        level: 'warning'
      });

      await database.resetDatabase();
      await queryClient.invalidateQueries();
      triggerRefresh();

      setUiState(prev => ({ 
        ...prev, 
        isResetModalVisible: false,
        isLoading: false 
      }));

      Alert.alert('Succès', 'Base de données réinitialisée avec succès');
    } catch (error) {
      setUiState(prev => ({ ...prev, isLoading: false }));
      handleError(error, 'Erreur lors de la réinitialisation');
      Sentry.captureException(error, {
        tags: { action: 'database_reset' }
      });
    }
  }, [queryClient, triggerRefresh]);

  const handleResetDatabase = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        setUiState(prev => ({ ...prev, isResetModalVisible: true }));
      } else {
        Alert.alert(
          'Réinitialiser la base de données',
          'Êtes-vous sûr de vouloir réinitialiser la base de données ? Cette action est irréversible.',
          [
            {
              text: 'Annuler',
              style: 'cancel',
            },
            {
              text: 'Réinitialiser',
              style: 'destructive',
              onPress: performReset
            }
          ],
          { cancelable: false }
        );
      }
    } catch (error) {
      handleError(error, 'Erreur lors de la réinitialisation');
    }
  }, [performReset]);

  const generateTestData = useCallback(async () => {
    if (__DEV__) {
      try {
        setUiState(prev => ({ ...prev, isLoading: true }));
        
        // Ajouter des catégories
        const cat1Id = await database.addCategory({ 
          name: 'Vêtements', 
          description: 'Tous types de vêtements',
        });
        const cat2Id = await database.addCategory({ 
          name: 'Électronique', 
          description: 'Appareils électroniques',
        });
        const cat3Id = await database.addCategory({ 
          name: 'Livres', 
          description: 'Livres et magazines',
        });

        // Ajouter des containers avec le nouveau système d'identifiants
        const container1 = await createContainer({ 
          number: 1,
          name: 'Box A1', 
          description: 'Premier container'
        });
        const container2 = await createContainer({ 
          number: 2,
          name: 'Box B2', 
          description: 'Deuxième container'
        });

        // Ajouter des items avec le nouveau système d'identifiants
        await createItem({
          name: 'T-shirt bleu',
          description: 'T-shirt en coton',
          purchasePrice: 5,
          sellingPrice: 15,
          status: 'available',
          categoryId: cat1Id,
          containerId: container1.id
        });

        await createItem({
          name: 'Smartphone',
          description: 'Téléphone Android',
          purchasePrice: 100,
          sellingPrice: 200,
          status: 'available',
          categoryId: cat2Id,
          containerId: container1.id
        });

        await createItem({
          name: 'Roman policier',
          description: 'Livre de poche',
          purchasePrice: 3,
          sellingPrice: 8,
          status: 'available',
          categoryId: cat3Id,
          containerId: container2.id
        });

        triggerRefresh();
        setUiState(prev => ({ ...prev, isLoading: false }));
        Alert.alert('Succès', 'Données de test générées avec succès');
      } catch (error) {
        setUiState(prev => ({ ...prev, isLoading: false }));
        handleError(error, 'Erreur lors de la génération des données de test');
      }
    } else {
      console.warn('Test data generation is disabled in production');
    }
  }, [triggerRefresh]);

  const handleNavigateToPerformance = useCallback(() => {
    setUiState(prev => ({ ...prev, showPerformance: true }));
  }, []);

  const handleBackFromPerformance = useCallback(() => {
    setUiState(prev => ({ ...prev, showPerformance: false }));
  }, []);

  if (!categories) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (uiState.showPerformance) {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBackFromPerformance}
          >
            <MaterialIcons name="arrow-back-ios" size={18} color="#007AFF" />
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Performance</Text>
        </View>
        <PerformanceDashboard />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.push('/(tabs)/stock')}
        >
          <MaterialIcons name="arrow-back-ios" size={18} color="#007AFF" />
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/(stack)/containers')}
      >
        <MaterialIcons name="inbox" size={24} color="#007AFF" />
        <Text style={styles.menuText}>Gérer les containers</Text>
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/(stack)/categories')}
      >
        <MaterialIcons name="category" size={24} color="#007AFF" />
        <Text style={styles.menuText}>Gérer les catégories</Text>
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/(stack)/labels')}
      >
        <MaterialIcons name="label" size={24} color="#007AFF" />
        <Text style={styles.menuText}>Générer des étiquettes</Text>
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.menuItem}
        onPress={handleNavigateToPerformance}
      >
        <MaterialIcons name="speed" size={24} color="#007AFF" />
        <Text style={styles.menuText}>Tableau de bord performance</Text>
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.menuItem, styles.dangerItem]}
        onPress={handleResetDatabase}
      >
        <MaterialIcons name="delete-forever" size={24} color="#FF3B30" />
        <Text style={[styles.menuText, styles.dangerText]}>Réinitialiser la base de données</Text>
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.menuItem, styles.dangerItem, { borderTopWidth: 0 }]}
        onPress={generateTestData}
      >
        <MaterialIcons name="science" size={24} color="#FF3B30" />
        <Text style={[styles.menuText, styles.dangerText]}>Générer données de test</Text>
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.menuItem, { marginTop: 20, borderTopWidth: 1, borderTopColor: '#e5e5e5' }]}
        onPress={handleLogout}
      >
        <MaterialIcons name="logout" size={24} color="#FF3B30" />
        <Text style={[styles.menuText, { color: '#FF3B30' }]}>Se déconnecter</Text>
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>

      <ConfirmationModal
        visible={uiState.isResetModalVisible}
        title="Réinitialiser la base de données"
        message="Êtes-vous sûr de vouloir réinitialiser la base de données ? Cette action est irréversible."
        onConfirm={performReset}
        onCancel={() => setUiState(prev => ({ ...prev, isResetModalVisible: false }))}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topBar: {
    height: Platform.OS === 'ios' ? 44 : 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginTop: Platform.OS === 'ios' ? 47 : 0,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    marginLeft: -theme.spacing.sm,
  },
  backButtonText: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.primary,
    marginLeft: -4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  menuText: {
    flex: 1,
    marginLeft: theme.spacing.md,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.primary,
  },
  dangerItem: {
    marginTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.danger.background,
  },
  dangerText: {
    color: theme.colors.danger.text,
    fontWeight: '500',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.secondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    width: Platform.OS === 'web' ? '80%' : '90%',
    maxWidth: 500,
  },
  modalTitle: {
    fontSize: theme.typography.h2.fontSize,
    fontWeight: 'bold',
    marginBottom: theme.spacing.sm,
    color: theme.colors.text.primary,
  },
  modalMessage: {
    fontSize: theme.typography.body.fontSize,
    marginBottom: theme.spacing.lg,
    color: theme.colors.text.primary,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
  modalButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
  },
  confirmButton: {
    backgroundColor: theme.colors.danger.main,
  },
  cancelButtonText: {
    color: theme.colors.text.disabled,
  },
  confirmButtonText: {
    color: theme.colors.text.inverse,
  },
  topBarTitle: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
    color: theme.colors.text.primary,
    flex: 1,
    textAlign: 'center',
    marginRight: theme.spacing.xl,
  },
});

export default SettingsScreen; 