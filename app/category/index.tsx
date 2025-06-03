import React, { useCallback, type FC, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import type { Category } from '../../src/types/category';
import { Icon, CommonHeader } from '../../src/components';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useCategories } from '../../src/hooks/useCategories';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { validateCategory } from '../../src/utils/validation';
import { checkNetworkConnection } from '../../src/utils/networkUtils';
import Toast from 'react-native-toast-message';
import * as Sentry from '@sentry/react-native';
import ConfirmationDialog from '../../src/components/ConfirmationDialog';
import { useAppTheme } from '../../src/contexts/ThemeContext';

// ✅ STYLEFACTORY selon stylefactory-optimization.mdc
import StyleFactory from '../../src/styles/StyleFactory';

const FLATLIST_CONFIG = {
  INITIAL_NUM_TO_RENDER: 10,
  MAX_TO_RENDER_PER_BATCH: 5,
  WINDOW_SIZE: 5,
  UPDATE_CELL_BATCH_INGSIZE: 5
};

interface CategoryCardProps {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onView: (category: Category) => void;
  styles: any;
  iconColor: string;
  editIconColor: string;
  deleteIconColor: string;
  viewIconColor: string;
}

const CategoryCard: FC<CategoryCardProps> = React.memo(({ 
  category, 
  onEdit, 
  onDelete, 
  onView,
  styles, 
  iconColor, 
  editIconColor, 
  deleteIconColor,
  viewIconColor
}) => {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(1) }],
    opacity: withSpring(1)
  }));

  return (
    <Animated.View style={[styles.categoryCard, animatedStyle]}>
      <TouchableOpacity 
        style={styles.categoryContent}
        onPress={() => onView(category)}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <Icon
            name={category.icon || 'folder'}
            size={24}
            color={iconColor}
          />
        </View>
        <View style={styles.categoryInfo}>
          <Text style={styles.categoryName}>{category.name}</Text>
          {category.description ? (
            <Text style={styles.categoryDescription} numberOfLines={2}>
              {category.description}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
      <View style={styles.categoryActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onView(category)}
        >
          <Icon name="visibility" size={20} color={viewIconColor} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onEdit(category)}
        >
          <Icon name="edit" size={20} color={editIconColor} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => onDelete(category)}
        >
          <Icon name="delete" size={20} color={deleteIconColor} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

const CategoryIndexScreen: FC = () => {
  const router = useRouter();
  const { activeTheme } = useAppTheme();
  
  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'CategoryCard');
  const headerStyles = StyleFactory.getThemedStyles(activeTheme, 'CommonHeader');

  const { categories, isLoading, error, handleDeleteCategory } = useCategories();
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    category: Category | null;
  }>({
    visible: false,
    category: null
  });

  const handleAddCategory = useCallback(() => {
    router.push('/category/add');
  }, [router]);

  const handleViewCategory = useCallback((category: Category) => {
    router.push(`/category/${category.id}/content`);
  }, [router]);

  const handleEditCategory = useCallback((category: Category) => {
    if (!validateCategory(category)) {
      Toast.show({
        type: 'error',
        text1: 'Erreur de validation',
        text2: 'Les données de la catégorie sont invalides'
      });
      return;
    }
    
    router.push(`/category/${category.id}/edit`);
  }, [router]);

  const promptDeleteCategory = useCallback(async (category: Category) => {
    if (!category.id) {
      Toast.show({
        type: 'error',
        text1: 'Erreur de validation',
        text2: 'Impossible de supprimer une catégorie sans ID'
      });
      return;
    }

    const networkAvailable = await checkNetworkConnection();
    if (!networkAvailable) {
      Toast.show({
        type: 'error',
        text1: 'Erreur de connexion',
        text2: 'Pas de connexion internet'
      });
      return;
    }

    setConfirmDialog({
      visible: true,
      category: category
    });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDialog.category?.id) return;
    
    try {
      await handleDeleteCategory(confirmDialog.category.id);
      Toast.show({
        type: 'success',
        text1: 'Succès',
        text2: 'Catégorie supprimée avec succès'
      });
    } catch (err) {
      Sentry.captureException(err, {
        extra: {
          categoryId: confirmDialog.category.id,
          categoryName: confirmDialog.category.name
        },
        tags: {
          action: 'delete_category'
        }
      });
      
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de supprimer la catégorie'
      });
    } finally {
      setConfirmDialog({
        visible: false,
        category: null
      });
    }
  }, [confirmDialog.category, handleDeleteCategory]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDialog({
      visible: false,
      category: null
    });
  }, []);

  const renderItem = useCallback(({ item }: { item: Category }) => (
    <CategoryCard
      category={item}
      onEdit={handleEditCategory}
      onDelete={promptDeleteCategory}
      onView={handleViewCategory}
      styles={styles}
      iconColor={activeTheme.primary}
      editIconColor={activeTheme.primary}
      deleteIconColor={activeTheme.danger.main}
      viewIconColor={activeTheme.text.secondary}
    />
  ), [handleEditCategory, promptDeleteCategory, handleViewCategory, styles, activeTheme]);

  const keyExtractor = useCallback((item: Category) => item.id?.toString() || 'unknown', []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
        <Text style={styles.loadingText}>Chargement des catégories...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error" size={48} color={activeTheme.danger.main} />
        <Text style={styles.errorTitle}>Erreur de chargement</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => window.location.reload()}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        {/* ✅ COMMONHEADER - Header standardisé */}
        <CommonHeader 
          title="Catégories"
          onBackPress={() => router.back()}
        />

        {/* Bouton d'ajout standardisé */}
        <TouchableOpacity style={headerStyles.headerActionButton} onPress={handleAddCategory}>
          <Icon name="add" size={24} color={activeTheme.text.onPrimary} />
          <Text style={headerStyles.headerActionText}>Ajouter une catégorie</Text>
        </TouchableOpacity>

        {categories.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="category" size={64} color={activeTheme.text.secondary} />
            <Text style={styles.emptyStateText}>Aucune catégorie</Text>
            <Text style={styles.emptyStateSubtext}>
              Commencez par créer une catégorie pour organiser vos articles
            </Text>
          </View>
        ) : (
          <FlatList
            data={categories}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            initialNumToRender={FLATLIST_CONFIG.INITIAL_NUM_TO_RENDER}
            maxToRenderPerBatch={FLATLIST_CONFIG.MAX_TO_RENDER_PER_BATCH}
            windowSize={FLATLIST_CONFIG.WINDOW_SIZE}
            updateCellsBatchingPeriod={FLATLIST_CONFIG.UPDATE_CELL_BATCH_INGSIZE}
            removeClippedSubviews={Platform.OS !== 'web'}
            getItemLayout={(_data, index) => ({
              length: 100, // Hauteur approximative d'un élément
              offset: 100 * index,
              index,
            })}
          />
        )}

        <ConfirmationDialog
          visible={confirmDialog.visible}
          title="Supprimer la catégorie"
          message={`Êtes-vous sûr de vouloir supprimer "${confirmDialog.category?.name || ''}" ?`}
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

export default CategoryIndexScreen; 