import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, Text, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

// ✅ STYLEFACTORY selon stylefactory-optimization.mdc
import StyleFactory from '../../src/styles/StyleFactory';

// Composants
import { ContainerGrid } from '../../src/components/ContainerGrid';
import { Icon, CommonHeader } from '../../src/components';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import ConfirmationDialog from '../../src/components/ConfirmationDialog';

// ✅ HOOKS OPTIMISÉS selon optimizations-hooks.mdc
import { useAllContainers, useContainerPageData } from '../../src/hooks/useOptimizedSelectors';
import { useContainers } from '../../src/hooks/useContainers';

// Redux et services
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../src/store/store';
import { removeContainer } from '../../src/store/containersSlice';
import { fetchItems } from '../../src/store/itemsThunks';
import { supabase } from '../../src/config/supabase';

// Hooks personnalisés
import { useAppTheme } from '../../src/contexts/ThemeContext';

const ContainerIndexScreen = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { activeTheme } = useAppTheme();
  
  // ✅ FORCER LE CHARGEMENT des containers depuis la DB
  const { refetch: refetchContainers } = useContainers();
  
  // ✅ HOOKS OPTIMISÉS - Utiliser les containers du store Redux (mis à jour par useContainers)
  const containers = useAllContainers();
  
  // Utiliser containerPageData pour forcer le chargement de TOUS les items
  const { items, isLoading: isLoadingItems } = useContainerPageData({
    status: 'all', // Tous les statuts pour avoir la liste complète
  });
  
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    containerId: number | null;
  }>({
    visible: false,
    containerId: null
  });

  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ContainerCard');
  const headerStyles = StyleFactory.getThemedStyles(activeTheme, 'CommonHeader');

  // Fonction de rafraîchissement qui force le rechargement de tous les items
  const refetchItems = useCallback(async () => {
    console.log('[ContainerScreen] Forçage du rechargement de TOUS les items');
    await dispatch(fetchItems({ page: 0, limit: 10000 }));
  }, [dispatch]);

  const handleRefresh = useCallback(async () => {
    try {
      console.log('[ContainerScreen] Rafraîchissement containers + items');
      await Promise.all([
        refetchItems(),
        refetchContainers()
      ]);
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
    }
  }, [refetchItems, refetchContainers]);

  // Navigation vers le contenu du container
  const handleContainerPress = useCallback((containerId: number) => {
    router.push(`/container/${containerId}/content`);
  }, [router]);

  // Navigation vers l'ajout de container
  const handleAddContainer = useCallback(() => {
    router.push('/container/add');
  }, [router]);

  const handleConfirmDelete = useCallback(async () => {
    const containerId = confirmDialog.containerId;
    if (!containerId) return;

    try {
      // Soft delete dans Supabase
      const { error: softDeleteContainerError } = await supabase
        .from('containers')
        .update({ deleted: true, updated_at: new Date().toISOString() })
        .eq('id', containerId);

      if (softDeleteContainerError) {
        throw new Error(`Impossible de supprimer le container : ${softDeleteContainerError.message}`);
      }

      // Mettre à jour Redux
      dispatch(removeContainer(containerId));
      
      // Rafraîchir les données
      await dispatch(fetchItems({ page: 0, limit: 1000 }));

    } catch (error: any) {
      console.error('Erreur lors de la suppression du container:', error);
      Alert.alert('Erreur de suppression', error.message || 'Une erreur est survenue lors de la suppression du container.');
    } finally {
      setConfirmDialog({ visible: false, containerId: null });
    }
  }, [confirmDialog.containerId, dispatch]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDialog({ visible: false, containerId: null });
  }, []);

  // Affichage du chargement
  if (isLoadingItems) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  // État vide
  if (!containers || containers.length === 0) {
    return (
      <ErrorBoundary>
        <View style={styles.container}>
          {/* ✅ COMMONHEADER - Header standardisé */}
          <CommonHeader 
            title="Containers"
            onBackPress={() => router.back()}
          />

          <View style={styles.emptyStateContainer}>
            <Icon name="inbox" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>Aucun container disponible</Text>
            <TouchableOpacity 
              style={headerStyles.headerActionButton} 
              onPress={handleAddContainer}
            >
              <Icon name="add" size={24} color={activeTheme.text.onPrimary} />
              <Text style={headerStyles.headerActionText}>Créer un container</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ErrorBoundary>
    );
  }

  // Interface principale - Grille responsive
  return (
    <ErrorBoundary>
      <View style={styles.container}>
        {/* ✅ COMMONHEADER - Header standardisé */}
        <CommonHeader 
          title="Containers"
          onBackPress={() => router.back()}
        />

        {/* Bouton Ajouter */}
        <TouchableOpacity 
          style={headerStyles.headerActionButton} 
          onPress={handleAddContainer}
        >
          <Icon name="add" size={24} color={activeTheme.text.onPrimary} />
          <Text style={headerStyles.headerActionText}>Ajouter un Container</Text>
        </TouchableOpacity>

        {/* Grille responsive */}
        <ContainerGrid
          containers={containers}
          items={items}
          onContainerPress={handleContainerPress}
          onRetry={handleRefresh}
        />

        {/* Dialog de confirmation de suppression */}
        <ConfirmationDialog
          visible={confirmDialog.visible}
          title="Supprimer le container"
          message="Êtes-vous sûr de vouloir supprimer ce container ? Les articles qu'il contient seront détachés."
          confirmText="Supprimer"
          cancelText="Annuler"
          confirmButtonStyle="destructive"
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      </View>
    </ErrorBoundary>
  );
};

export default React.memo(ContainerIndexScreen); 