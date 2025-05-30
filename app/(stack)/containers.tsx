import React, { useState, useCallback, useMemo } from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, Text, SafeAreaView, Alert, ActivityIndicator, TextInput, ScrollView, Platform, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Container } from '../../src/types/container';
import { Item } from '../../src/types/item';
import { Category } from '../../src/types/category';
import { ContainerGrid } from '../../src/components/ContainerGrid';
import { ContainerForm } from '../../src/components/ContainerForm';
import { useItems } from '../../src/hooks/useItems';
import { useCategories } from '../../src/hooks/useCategories';
import { useContainers } from '../../src/hooks/useContainers';
import { supabase } from '../../src/config/supabase';
import { useRefreshStore } from '../../src/store/refreshStore';
import { Icon } from '../../src/components';
import { useDispatch, useSelector } from 'react-redux';
import { updateItem } from '../../src/store/itemsActions';
import { selectAllItems } from '../../src/store/itemsAdapter';
import { RootState, AppDispatch } from '../../src/store/store';
import { useAppTheme } from '../../src/contexts/ThemeContext';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { useContainerManagement } from '../../src/hooks/useContainerManagement';
import { useSearchDebounce } from '../../src/hooks/useSearchDebounce';
import { removeContainer, updateContainer, addContainer } from '../../src/store/containersSlice';
import ConfirmationDialog from '../../src/components/ConfirmationDialog';
import { fetchItems } from '../../src/store/itemsThunks';

interface ContainerInfoProps {
  containerId: number | null;
  containers: Container[];
  style?: any;
}

const ContainerInfo: React.FC<ContainerInfoProps> = ({ containerId, containers, style }) => {
  const containerText = React.useMemo(() => {
    if (!containerId) {
      return "Sans container";
    }
    
    const container = containers.find(c => c.id === containerId);
    if (!container) {
      return "Container inconnu";
    }
    
    return container.name + (container.number ? ' #' + container.number : '');
  }, [containerId, containers]);
  
  return <Text style={style}>{containerText}</Text>;
};

const ContainerScreen = () => {
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [showContainerForm, setShowContainerForm] = useState(false);
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);
  const { searchQuery, setSearchQuery } = useSearchDebounce();
  
  // Utiliser les hooks Redux dédiés pour chaque entité
  const { data: containers, refetch } = useContainers();
  const { isLoading: isLoadingItems, refetch: refetchItems } = useItems();
  const { categories, isLoading: isLoadingCategories } = useCategories();
  
  const itemsInRedux = useSelector((state: RootState) => selectAllItems(state));
  const triggerRefresh = useRefreshStore(state => state.triggerRefresh);
  const router = useRouter();
  const { handleContainerSubmit } = useContainerManagement();
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    containerId: number | null;
  }>({
    visible: false,
    containerId: null
  });
  const { activeTheme, themeMode } = useAppTheme();

  const { assignedItems, filteredAvailableItems } = useMemo(() => {
    const assigned = itemsInRedux.filter((item: Item) => 
      item.containerId === selectedContainer?.id && 
      item.status === 'available'
    );

    const available = itemsInRedux.filter((item: Item) => 
      item.status === 'available' && 
      (item.containerId === null || item.containerId !== selectedContainer?.id)
    );
    
    const filtered = available.filter((item: Item) => {
      const matchesSearch = searchQuery ? 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) : true;
      const matchesCategory = selectedCategory ? 
        item.categoryId === selectedCategory : true;
      return matchesSearch && matchesCategory;
    });

    return {
      assignedItems: assigned,
      filteredAvailableItems: filtered
    };
  }, [itemsInRedux, selectedContainer?.id, searchQuery, selectedCategory, forceUpdate]);

  const handleContainerPress = useCallback((containerId: number) => {
    const container = containers.find((c: Container) => c.id === containerId);
    if (container) {
      setSelectedContainer(container);
    }
  }, [containers]);

  const handleEditContainer = useCallback((container: Container) => {
    setEditingContainer(container);
    setShowContainerForm(true);
    setSelectedContainer(null);
  }, []);

  const handleAddToContainer = useCallback(async (itemId: number) => {
    if (!selectedContainer?.id) return;

    const itemToUpdate = itemsInRedux.find((item: Item) => item.id === itemId);
    if (!itemToUpdate) return;

    const updatedItemData = {
      ...itemToUpdate,
      containerId: selectedContainer.id,
      updatedAt: new Date().toISOString()
    };

    dispatch(updateItem(updatedItemData));
    
    setForceUpdate(prev => prev + 1);

    (async () => {
      try {
        const { error } = await supabase
          .from('items')
          .update({
            container_id: selectedContainer.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', itemId);

        if (error) {
          dispatch(updateItem(itemToUpdate));
          console.error('Erreur lors de l\'ajout au container:', error);
          Alert.alert(
            'Erreur',
            'Une erreur est survenue lors de l\'ajout de l\'article au container.'
          );
        } else {
          await dispatch(fetchItems({ page: 0, limit: 1000 }));
        }
      } catch (error) {
        dispatch(updateItem(itemToUpdate));
        console.error('Erreur lors de l\'ajout au container:', error);
      }
    })();

  }, [selectedContainer, itemsInRedux, dispatch, forceUpdate]);

  const handleDeleteFromContainer = useCallback(async (itemId: number) => {
    const itemToUpdate = itemsInRedux.find((item: Item) => item.id === itemId);
    if (!itemToUpdate) return;

    const updatedItemData = {
      ...itemToUpdate,
      containerId: null,
      updatedAt: new Date().toISOString()
    };

    dispatch(updateItem(updatedItemData));
    
    setForceUpdate(prev => prev + 1);

    try {
      const { error } = await supabase
        .from('items')
        .update({
          container_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId);

      if (error) {
        dispatch(updateItem(itemToUpdate));
        console.error('Erreur lors de la suppression du container:', error);
        Alert.alert(
          'Erreur',
          'Une erreur est survenue lors de la suppression de l\'article du container.'
        );
      } else {
        await dispatch(fetchItems({ page: 0, limit: 1000 }));
      }
    } catch (error) {
      dispatch(updateItem(itemToUpdate));
      console.error('Erreur lors de la suppression du container:', error);
    }
  }, [itemsInRedux, dispatch, forceUpdate]);

  const handleDeleteContainer = useCallback(async (containerId: number) => {
    setConfirmDialog({
      visible: true,
      containerId: containerId
    });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    const containerId = confirmDialog.containerId;
    if (!containerId) return;

    try {
      const { error: updateItemsError } = await supabase
        .from('items')
        .update({ container_id: null, updated_at: new Date().toISOString() })
        .eq('container_id', containerId);

      if (updateItemsError) {
        console.error('Erreur lors du détachement des articles dans Supabase:', updateItemsError);
        throw new Error(`Impossible de détacher les articles du container : ${updateItemsError.message}`);
      }

      console.log(`[Supabase] Articles détachés pour container ${containerId}.`);

      const { error: softDeleteContainerError } = await supabase
        .from('containers')
        .update({ deleted: true, updated_at: new Date().toISOString() })
        .eq('id', containerId);

      if (softDeleteContainerError) {
        console.error('Erreur lors de la suppression douce du conteneur dans Supabase:', softDeleteContainerError);
        throw new Error(`Impossible de marquer le container comme supprimé : ${softDeleteContainerError.message}`);
      }

      console.log(`[Supabase] Container ${containerId} marqué comme supprimé.`);

      dispatch(removeContainer(containerId));
      console.log(`[Redux] Container ${containerId} retiré de l'état local (UI).`);

      const itemsInContainer = itemsInRedux.filter(item => item.containerId === containerId);
       console.log(`[Redux] Trouvé ${itemsInContainer.length} articles à détacher localement.`);

      itemsInContainer.forEach(item => {
        if (item.id) {
          dispatch(updateItem({
            ...item,
            containerId: null,
            updatedAt: new Date().toISOString()
          }));
           console.log(`[Redux] Article ${item.id} détaché localement.`);
        }
      });

      setSelectedContainer(null);

      // Rafraîchir les données via Redux
      await dispatch(fetchItems({ page: 0, limit: 1000 }));

      console.log('[Redux] Items rechargés après suppression container.');

      triggerRefresh();
      console.log('[App] Refresh global déclenché.');

    } catch (error: any) {
      console.error('Erreur globale lors de la suppression douce du container:', error);
      Alert.alert('Erreur de suppression', error.message || 'Une erreur inconnue est survenue lors de la suppression du container.');

    } finally {
      setConfirmDialog({ visible: false, containerId: null });
    }
  }, [confirmDialog.containerId, dispatch, itemsInRedux, triggerRefresh, setSelectedContainer]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDialog({ visible: false, containerId: null });
  }, []);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      // Rafraîchir les données via les hooks dédiés
      await Promise.all([
        refetchItems(), // Items et categories
        refetch() // Containers via Redux
      ]);
      setForceUpdate(prev => prev + 1);
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refetchItems, refetch, setForceUpdate]);

  const renderItem = useCallback(({ item }: { item: Item }) => (
    <ItemListItem
      item={item}
      onPress={handleAddToContainer}
      categories={categories}
      containers={containers}
      itemListItemIconColor={activeTheme.success}
    />
  ), [categories, handleAddToContainer, containers, activeTheme.success]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: activeTheme.background,
    },
    topBar: {
      height: Platform.OS === 'ios' ? 44 : 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      backgroundColor: activeTheme.backgroundSecondary,
      borderBottomWidth: 1,
      borderBottomColor: activeTheme.border,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButtonText: {
      fontSize: 17,
      color: activeTheme.success,
      marginLeft: -4,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: activeTheme.background,
    },
    loadingText: {
      marginTop: 10,
      color: activeTheme.text.secondary,
    },
    emptyStateContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: activeTheme.background,
    },
    emptyStateText: {
      fontSize: 18,
      color: activeTheme.text.secondary,
      marginTop: 16,
      marginBottom: 24,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: activeTheme.primary,
      padding: 15,
      margin: 10,
      borderRadius: 12,
      elevation: 2,
    },
    addIcon: {
      marginRight: 8,
    },
    addButtonText: {
      color: activeTheme.text.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    modalContent: {
      flex: 1,
      backgroundColor: activeTheme.background,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: activeTheme.surface,
      borderBottomWidth: 1,
      borderBottomColor: activeTheme.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: activeTheme.text.primary,
    },
    headerSpacer: {
      width: 70,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 16,
    },
    cancelButton: {
      padding: 8,
    },
    cancelButtonText: {
      color: activeTheme.success,
      fontSize: 16,
    },
    actionButton: {
      padding: 8,
    },
    deleteButton: {
      marginLeft: 8,
    },
    formWrapper: {
      flex: 1,
      padding: 20,
      backgroundColor: activeTheme.surface,
    },
    containerDetails: {
      backgroundColor: activeTheme.surface,
      padding: 16,
      marginBottom: 8,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    detailLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: activeTheme.text.secondary,
      width: 100,
    },
    detailValue: {
      fontSize: 16,
      color: activeTheme.text.primary,
      flex: 1,
    },
    containerContent: {
      flex: 1,
      backgroundColor: activeTheme.surface,
    },
    contentTitle: {
      fontSize: 18,
      fontWeight: '600',
      padding: 16,
      backgroundColor: activeTheme.backgroundSecondary,
      borderBottomWidth: 1,
      borderBottomColor: activeTheme.border,
    },
    emptyContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    emptyContentText: {
      fontSize: 16,
      color: activeTheme.text.secondary,
      fontStyle: 'italic',
    },
    itemsContainer: {
      flex: 1,
      padding: 16,
    },
    listsContainer: {
      flex: 1,
      flexDirection: 'row',
      gap: 16,
    },
    listSection: {
      flex: 1,
      borderRadius: 12,
      backgroundColor: activeTheme.backgroundSecondary,
      padding: 12,
    },
    itemsList: {
      flex: 1,
    },
    itemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: activeTheme.surface,
      padding: 16,
      borderRadius: 12,
      marginBottom: 8,
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      elevation: 2,
      borderLeftWidth: 4,
      borderLeftColor: activeTheme.success,
    },
    availableItem: {
      borderLeftColor: activeTheme.success,
    },
    itemInfo: {
      flex: 1,
    },
    itemName: {
      fontSize: 16,
      fontWeight: '500',
      marginBottom: 4,
      color: activeTheme.text.primary, 
    },
    itemPrice: {
      fontSize: 14,
      color: activeTheme.text.secondary,
    },
    filterSection: {
      marginBottom: 16,
    },
    searchInput: {
      backgroundColor: activeTheme.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      fontSize: 16,
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      elevation: 2,
      color: activeTheme.text.primary,
    },
    categoryFilter: {
      flexGrow: 0,
      marginBottom: 8,
    },
    categoryChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: activeTheme.surface,
      marginRight: 8,
      borderWidth: 1,
      borderColor: activeTheme.border,
    },
    categoryChipSelected: {
      backgroundColor: activeTheme.primary,
      borderColor: activeTheme.primary,
    },
    categoryChipText: {
      fontSize: 14,
      color: activeTheme.text.secondary,
    },
    categoryChipTextSelected: {
      color: activeTheme.text.onPrimary,
      fontWeight: '500',
    },
    itemMetaContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
      marginTop: 6,
      flexWrap: 'wrap',
      gap: 8,
    },
    itemCategory: {
      fontSize: 12,
      color: activeTheme.text.secondary,
      backgroundColor: activeTheme.surface,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: activeTheme.border,
      overflow: 'hidden',
    },
    itemContainer: {
      fontSize: 12,
      color: activeTheme.text.secondary,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: activeTheme.surface,
      borderWidth: 1,
      borderColor: activeTheme.border,
      overflow: 'hidden',
    },
    noContainer: {
      backgroundColor: activeTheme.error,
      borderColor: activeTheme.error,
      color: activeTheme.text.onPrimary, 
    },
    containerScrollView: {
      flex: 1,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: activeTheme.text.secondary,
      marginBottom: 12,
    },
    containerInfo: {
      fontSize: 12,
      color: activeTheme.success,
      marginBottom: 4,
      fontStyle: 'italic'
    },
    formScrollContent: {
      flexGrow: 1,
    },
    errorStateContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: activeTheme.background,
      padding: 20,
    },
    errorStateText: {
      fontSize: 18,
      color: activeTheme.error,
      textAlign: 'center',
      marginBottom: 16,
    },
    retryButton: {
      backgroundColor: activeTheme.primary,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
    },
    retryButtonText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: activeTheme.text.onPrimary,
    },
    listContentContainer: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginVertical: 6,
      backgroundColor: activeTheme.surface,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: themeMode === 'dark' ? 0.5 : 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    itemTextContainer: {
      flex: 1,
      marginRight: 10,
      color: activeTheme.text.primary,
    },
    itemDetails: {
      fontSize: 13,
      color: activeTheme.text.secondary,
      marginTop: 4,
    },
    itemDate: {
      fontSize: 12,
      color: activeTheme.text.disabled,
      marginTop: 4,
    },
    modalContainer: { 
    },
    modalView: {
      margin: 20,
      width: '80%',
      backgroundColor: activeTheme.surface,
      borderRadius: 10,
      padding: 20,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: themeMode === 'dark' ? 0.75 : 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    modalInput: {
      width: '100%',
      height: 40,
      borderColor: activeTheme.border,
      borderWidth: 1,
      borderRadius: 5,
      paddingHorizontal: 10,
      marginBottom: 20,
      color: activeTheme.text.primary,
    },
    modalButtonContainer: {
      flexDirection: 'row',
    },
    modalButton: {
      borderRadius: 5,
      paddingVertical: 10,
      paddingHorizontal: 20,
      elevation: 2,
      marginHorizontal: 10,
    },
    modalButtonSave: {
      backgroundColor: activeTheme.primary,
    },
    modalButtonCancel: {
      backgroundColor: activeTheme.backgroundSecondary,
      borderWidth: 1,
      borderColor: activeTheme.border,
    },
    modalButtonTextSave: {
      color: activeTheme.text.onPrimary,
      fontWeight: 'bold',
    },
    modalButtonTextCancel: {
      color: activeTheme.text.primary,
      fontWeight: 'bold',
    },
  }), [activeTheme, themeMode]);

  interface ItemListProps {
    item: Item;
    onPress: (id: number) => void;
    categories: Array<{ id: number; name: string }>;
    containers: Container[];
    itemListItemIconColor: string;
  }

  const ItemListItem: React.FC<ItemListProps> = React.memo(({ item, onPress, categories, containers, itemListItemIconColor }) => {
    const categoryName = React.useMemo(() => 
      categories.find((c: { id: number; name: string }) => c.id === item.categoryId)?.name || 'Sans catégorie', 
      [categories, item.categoryId]
    );
    
    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => item.id && onPress(item.id)}
      >
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <View style={styles.itemMetaContainer}>
            <Text style={styles.itemCategory}>{categoryName}</Text>
            <ContainerInfo 
              containerId={item.containerId ?? null} 
              containers={containers} 
              style={[styles.itemContainer, !item.containerId && styles.noContainer]}
            />
          </View>
          <Text style={styles.itemPrice}>
            {item.sellingPrice !== null && item.sellingPrice !== undefined 
              ? `${item.sellingPrice}€` 
              : ''
            }
          </Text>
        </View>
        <Icon name="add_circle_outline" size={24} color={itemListItemIconColor} />
      </TouchableOpacity>
    );
  });

  if (isLoadingItems || isLoadingCategories) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Chargement des containers...</Text>
      </View>
    );
  }

  if (!containers || containers.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.topBar, { marginTop: Platform.OS === 'ios' ? insets.top : 0 }]}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.push('/(stack)/settings')}
          >
            <Icon name="arrow_back_ios" size={18} color="#007AFF" />
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.emptyStateContainer}>
          <Icon name="inbox" size={64} color="#ccc" />
          <Text style={styles.emptyStateText}>Aucun container disponible</Text>
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={() => setShowContainerForm(true)}
          >
            <Text style={styles.addButtonText}>Créer un container</Text>
          </TouchableOpacity>
        </View>

        <Modal
          visible={showContainerForm}
          animationType="slide"
          onRequestClose={() => {
            setShowContainerForm(false);
            setEditingContainer(null);
          }}
        >
          <SafeAreaView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => {
                  setShowContainerForm(false);
                  setEditingContainer(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Nouveau Container</Text>
              <View style={styles.headerSpacer} />
            </View>
            
            <ScrollView contentContainerStyle={styles.formScrollContent}>
              <View style={styles.formWrapper}>
                <ContainerForm
                  onSubmit={async (containerData) => {
                    const result = await handleContainerSubmit(containerData);
                    if (result.success && result.container) {
                      dispatch(addContainer(result.container));
                      
                      setShowContainerForm(false);
                      setEditingContainer(null);
                    }
                    return result.success;
                  }}
                  onCancel={() => {
                    setShowContainerForm(false);
                    setEditingContainer(null);
                  }}
                />
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        <ConfirmationDialog
          visible={confirmDialog.visible}
          title="Supprimer le container"
          message="Êtes-vous sûr de vouloir supprimer ce container ? Les articles qu'il contient ne seront pas supprimés mais seront détachés du container."
          confirmText="Supprimer"
          cancelText="Annuler"
          confirmButtonStyle="destructive"
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <View style={[styles.topBar, { marginTop: Platform.OS === 'ios' ? insets.top : 0 }]}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.push('/(stack)/settings')}
          >
            <Icon name="arrow_back_ios" size={18} color="#007AFF" />
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => setShowContainerForm(true)}
        >
          <Icon name="add" size={24} color="#fff" style={styles.addIcon} />
          <Text style={styles.addButtonText}>Ajouter un Container</Text>
        </TouchableOpacity>

        <ContainerGrid
          containers={containers}
          items={itemsInRedux}
          onContainerPress={handleContainerPress}
          onRetry={handleRefresh}
        />

        <Modal
          visible={showContainerForm}
          animationType="slide"
          onRequestClose={() => {
            setShowContainerForm(false);
            setEditingContainer(null);
          }}
        >
          <SafeAreaView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => {
                  setShowContainerForm(false);
                  setEditingContainer(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editingContainer ? 'Modifier Container' : 'Nouveau Container'}
              </Text>
              <View style={styles.headerSpacer} />
            </View>
            
            <ScrollView contentContainerStyle={styles.formScrollContent}>
              <View style={styles.formWrapper}>
                <ContainerForm
                  initialData={editingContainer}
                  onSubmit={async (containerData) => {
                    const result = await handleContainerSubmit(containerData);
                    if (result.success && result.container) {
                      if (editingContainer?.id) {
                        dispatch(updateContainer(result.container));
                      } else {
                        dispatch(addContainer(result.container));
                      }
                      
                      setShowContainerForm(false);
                      setEditingContainer(null);
                    }
                    return result.success;
                  }}
                  onCancel={() => {
                    setShowContainerForm(false);
                    setEditingContainer(null);
                  }}
                />
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        <Modal
          visible={!!selectedContainer}
          animationType="slide"
          onRequestClose={() => setSelectedContainer(null)}
        >
          <SafeAreaView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setSelectedContainer(null)}
              >
                <Text style={styles.cancelButtonText}>Retour</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {selectedContainer?.name || 'Container'}
              </Text>
              <View style={styles.headerActions}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => selectedContainer && handleEditContainer(selectedContainer)}
                >
                  <Icon name="edit" size={24} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => selectedContainer?.id && handleDeleteContainer(selectedContainer.id)}
                >
                  <Icon name="delete" size={24} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>
            
            <ScrollView style={styles.containerScrollView}>
              <View style={styles.containerDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Numéro:</Text>
                  <Text style={styles.detailValue}>#{selectedContainer?.number}</Text>
                </View>
                {selectedContainer?.description && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Description:</Text>
                    <Text style={styles.detailValue}>{selectedContainer.description}</Text>
                  </View>
                )}
              </View>

              <View style={styles.containerContent}>
                <Text style={styles.contentTitle}>Articles dans ce container</Text>
                <View style={styles.itemsContainer}>
                  <View style={styles.filterSection}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Rechercher un article..."
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      style={styles.categoryFilter}
                    >
                      <TouchableOpacity
                        style={[
                          styles.categoryChip,
                          !selectedCategory && styles.categoryChipSelected
                        ]}
                        onPress={() => setSelectedCategory(null)}
                      >
                        <Text style={[
                          styles.categoryChipText,
                          !selectedCategory && styles.categoryChipTextSelected
                        ]}>Tous</Text>
                      </TouchableOpacity>
                      {categories.map((category: Category) => (
                        <TouchableOpacity
                          key={category.id}
                          style={[
                            styles.categoryChip,
                            selectedCategory === category.id && styles.categoryChipSelected
                          ]}
                          onPress={() => setSelectedCategory(
                            selectedCategory === category.id ? null : category.id ?? null
                          )}
                        >
                          <Text style={[
                            styles.categoryChipText,
                            selectedCategory === category.id && styles.categoryChipTextSelected
                          ]}>{category.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={styles.listsContainer}>
                    <View style={styles.listSection}>
                      <Text style={styles.sectionTitle}>
                        Articles assignés ({assignedItems.length})
                      </Text>
                      <ScrollView 
                        style={styles.itemsList}
                        contentContainerStyle={assignedItems.length === 0 ? { flex: 1, justifyContent: 'center', alignItems: 'center' } : undefined}
                        refreshControl={
                          <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                          />
                        }
                      >
                        {assignedItems.length > 0 ? (
                          assignedItems.map(item => {
                            const categoryName = categories.find((c: Category) => c.id === item.categoryId)?.name || 'Sans catégorie';
                            return (
                              <TouchableOpacity
                                key={item.id}
                                style={styles.itemCard}
                                onPress={() => item.id && handleDeleteFromContainer(item.id)}
                              >
                                <View style={styles.itemInfo}>
                                  <Text style={styles.itemName}>{item.name}</Text>
                                  <View style={styles.itemMetaContainer}>
                                    <Text style={styles.itemCategory}>
                                      {categoryName}
                                    </Text>
                                    <ContainerInfo 
                                      containerId={item.containerId ?? null} 
                                      containers={containers} 
                                      style={[styles.itemContainer, !item.containerId && styles.noContainer]}
                                    />
                                  </View>
                                  <Text style={styles.itemPrice}>{item.sellingPrice}€</Text>
                                </View>
                                <Icon name="remove_circle_outline" size={24} color="#FF3B30" />
                              </TouchableOpacity>
                            );
                          })
                        ) : (
                          <Text style={styles.emptyContentText}>Aucun article dans ce container</Text>
                        )}
                      </ScrollView>
                    </View>

                    <View style={styles.listSection}>
                      <Text style={styles.sectionTitle}>
                        Articles disponibles ({filteredAvailableItems.length})
                      </Text>
                      <FlashList
                        data={filteredAvailableItems}
                        renderItem={renderItem}
                        estimatedItemSize={100}
                        keyExtractor={item => String(item.id || '')}
                        showsVerticalScrollIndicator={false}
                        extraData={`${filteredAvailableItems.length}-${assignedItems.length}-${forceUpdate}`}
                        onRefresh={handleRefresh}
                        refreshing={refreshing}
                      />
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        <ConfirmationDialog
          visible={confirmDialog.visible}
          title="Supprimer le container"
          message="Êtes-vous sûr de vouloir supprimer ce container ? Les articles qu'il contient ne seront pas supprimés mais seront détachés du container."
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

export default React.memo(ContainerScreen);