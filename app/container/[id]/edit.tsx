import React, { useState, useEffect } from 'react';
import { Alert, ScrollView, ActivityIndicator, TouchableOpacity, Text, StyleSheet, View, SafeAreaView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ✅ STYLEFACTORY selon stylefactory-optimization.mdc
import StyleFactory from '../../../src/styles/StyleFactory';

// Composants
import { ContainerForm } from '../../../src/components/ContainerForm';
import { CommonHeader, Icon } from '../../../src/components';
import { ErrorBoundary } from '../../../src/components/ErrorBoundary';
import ConfirmationDialog from '../../../src/components/ConfirmationDialog';

// Hooks et Redux
import { useContainerManagement } from '../../../src/hooks/useContainerManagement';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../../src/store/store';
import { updateContainer, removeContainer } from '../../../src/store/containersSlice';
import { useAllContainers } from '../../../src/hooks/useOptimizedSelectors';
import { useAppTheme } from '../../../src/contexts/ThemeContext';
import { supabase } from '../../../src/config/supabase';

const EditContainerScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const { activeTheme } = useAppTheme();
  
  const insets = useSafeAreaInsets();
  
  const containers = useAllContainers();
  const container = containers.find(c => c.id === parseInt(id || '0', 10));
  
  const { handleContainerSubmit } = useContainerManagement();
  
  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ContainerCard');
  const localStyles = getLocalStyles(activeTheme);

  // Formulaire et validation
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    number: 0,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  // Charger les données du container existant
  useEffect(() => {
    if (container) {
      setFormData({
        name: container.name || '',
        description: container.description || '',
        number: container.number || 0,
      });
    }
  }, [container]);

  useEffect(() => {
    if (!container && containers.length > 0) {
      Alert.alert(
        'Container introuvable',
        'Le container demandé n\'existe pas.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  }, [container, containers.length, router]);

  const handleSave = async (containerData: any) => {
    if (!container) return false;

    try {
      setIsSaving(true);
      
      // Mise à jour via hook de gestion
      const result = await handleContainerSubmit({
        id: container.id,
        ...containerData,
      });

      if (result.success && result.container) {
        // Mise à jour Redux
        dispatch(updateContainer(result.container));

        // Retourner à la page de contenu ou la liste des containers
        router.push('/container');
        return true;
      } else {
        Alert.alert('Erreur', 'Impossible de modifier le container');
        return false;
      }
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour du container:', error);
      Alert.alert('Erreur', error.message || 'Impossible de modifier le container');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!container) {
      console.log('Aucun container trouvé pour la suppression');
      return;
    }

    console.log('Tentative de suppression du container:', container.id, container.name);
    setShowDeleteConfirmation(true);
  };

  const confirmDelete = async () => {
    if (!container) return;

    try {
      console.log('Suppression confirmée, début de la suppression...');
      
      // Soft delete dans Supabase
      const { error } = await supabase
        .from('containers')
        .update({ deleted: true, updated_at: new Date().toISOString() })
        .eq('id', container.id);

      if (error) {
        throw new Error(`Impossible de supprimer le container : ${error.message}`);
      }

      console.log('Container supprimé de la base de données');

      // Mettre à jour Redux
      dispatch(removeContainer(container.id));
      console.log('Container supprimé du store Redux');
      
      // Fermer le modal
      setShowDeleteConfirmation(false);
      
      // Retourner à la liste des containers
      router.replace('/container');
    } catch (error: any) {
      console.error('Erreur lors de la suppression du container:', error);
      setShowDeleteConfirmation(false);
      Alert.alert('Erreur de suppression', error.message || 'Une erreur est survenue lors de la suppression du container.');
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirmation(false);
  };

  const handleCancel = () => {
    router.push('/container');
  };

  // Bouton de suppression
  const renderDeleteButton = () => (
    <TouchableOpacity 
      style={localStyles.deleteButton}
      onPress={() => {
        console.log('Bouton supprimer cliqué');
        handleDelete();
      }}
    >
      <Icon name="delete" size={20} color={activeTheme.danger.main} />
      <Text style={localStyles.deleteButtonText}>
        Supprimer
      </Text>
    </TouchableOpacity>
  );

  // État de chargement
  if (!container && containers.length === 0) {
    return (
      <View style={[styles.loadingContainer, { paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
      </View>
    );
  }

  // Container introuvable
  if (!container) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <CommonHeader 
          title="Container Introuvable"
          onBackPress={() => router.back()}
        />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaView style={[
        styles.container, 
        Platform.OS === 'web' ? { paddingTop: 0 } : {}
      ]}>
        {/* ✅ COMMONHEADER - Header standardisé */}
        <CommonHeader 
          title={`Modifier ${container.name}`}
          onBackPress={() => router.back()}
          rightComponent={renderDeleteButton()}
        />
        
        <ScrollView style={styles.container}>
          <ContainerForm
            initialData={container}
            onSubmit={handleSave}
            onCancel={handleCancel}
          />
        </ScrollView>

        {/* Modal de confirmation de suppression */}
        <ConfirmationDialog
          visible={showDeleteConfirmation}
          title="Supprimer le container"
          message={`Êtes-vous sûr de vouloir supprimer "${container.name}" ? Les articles qu'il contient seront détachés.`}
          confirmText="Supprimer"
          cancelText="Annuler"
          confirmButtonStyle="destructive"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      </SafeAreaView>
    </ErrorBoundary>
  );
};

// Styles locaux pour les éléments spécifiques à cette page
const getLocalStyles = (theme: any) => StyleSheet.create({
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: `${theme.danger.main}10`,
    borderWidth: 1,
    borderColor: `${theme.danger.main}30`,
  },
  deleteButtonText: {
    color: theme.danger.main,
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default EditContainerScreen; 