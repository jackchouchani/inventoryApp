import React, { useCallback, type FC, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Platform,
  type ViewStyle,
  type TextStyle
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Category } from '../../src/types/category';
import { Icon } from '../../src/components';
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
  styles: Pick<StylesType, 'categoryCard' | 'categoryContent' | 'iconContainer' | 'categoryInfo' | 'categoryName' | 'categoryDescription' | 'categoryActions' | 'actionButton' | 'deleteButton'>;
  iconColor: string;
  editIconColor: string;
  deleteIconColor: string;
}

interface StylesType {
  container: ViewStyle;
  topBar: ViewStyle;
  backButton: ViewStyle;
  backButtonText: TextStyle;
  header: ViewStyle;
  title: TextStyle;
  addButton: ViewStyle;
  addButtonText: TextStyle;
  list: ViewStyle;
  categoryCard: ViewStyle;
  categoryContent: ViewStyle;
  iconContainer: ViewStyle;
  categoryInfo: ViewStyle;
  categoryName: TextStyle;
  categoryDescription: TextStyle;
  categoryActions: ViewStyle;
  actionButton: ViewStyle;
  deleteButton: ViewStyle;
  loadingContainer: ViewStyle;
  loadingText: TextStyle;
  emptyState: ViewStyle;
  emptyStateText: TextStyle;
  emptyStateSubtext: TextStyle;
  errorContainer: ViewStyle;
  errorTitle: TextStyle;
  errorText: TextStyle;
  retryButton: ViewStyle;
  retryButtonText: TextStyle;
}

const CategoryCard: FC<CategoryCardProps> = React.memo(({ 
  category, 
  onEdit, 
  onDelete, 
  styles, 
  iconColor, 
  editIconColor, 
  deleteIconColor 
}) => {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(1) }],
    opacity: withSpring(1)
  }));

  return (
    <Animated.View style={[styles.categoryCard, animatedStyle]}>
      <View style={styles.categoryContent}>
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
      </View>
      <View style={styles.categoryActions}>
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

const CategoryScreen: FC = () => {
  const router = useRouter();
  const { activeTheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getThemedStyles(activeTheme), [activeTheme]);

  const { categories, isLoading, error, handleDeleteCategory } = useCategories();
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    category: Category | null;
  }>({
    visible: false,
    category: null
  });

  const handleAddCategory = useCallback(() => {
    router.push('/(stack)/add-category');
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
    
    router.push({
      pathname: '/(stack)/edit-category',
      params: { id: category.id }
    });
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
          categoryName: confirmDialog.category.name,
          action: 'delete_category'
        }
      });
      Toast.show({
        type: 'error',
        text1: 'Erreur de suppression',
        text2: 'Impossible de supprimer la catégorie'
      });
    } finally {
      setConfirmDialog({ visible: false, category: null });
    }
  }, [confirmDialog.category, handleDeleteCategory]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDialog({ visible: false, category: null });
  }, []);

  const renderItem = useCallback(({ item }: { item: Category }) => (
    <CategoryCard 
      category={item} 
      onEdit={handleEditCategory} 
      onDelete={promptDeleteCategory}
      styles={{
        categoryCard: styles.categoryCard,
        categoryContent: styles.categoryContent,
        iconContainer: styles.iconContainer,
        categoryInfo: styles.categoryInfo,
        categoryName: styles.categoryName,
        categoryDescription: styles.categoryDescription,
        categoryActions: styles.categoryActions,
        actionButton: styles.actionButton,
        deleteButton: styles.deleteButton,
      }}
      iconColor={activeTheme.primary}
      editIconColor={activeTheme.primary}
      deleteIconColor={activeTheme.danger.main}
    />
  ), [handleEditCategory, promptDeleteCategory, styles, activeTheme]);

  const keyExtractor = useCallback((item: Category) => 
    item.id?.toString() || Math.random().toString()
  , []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Chargement des catégories...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error_outline" size={64} color="#FF3B30" />
        <Text style={styles.errorTitle}>Une erreur est survenue</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => router.replace('/(stack)/categories')}
        >
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
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

        <View style={styles.header}>
          <Text style={styles.title}>Catégories</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddCategory}
          >
            <Icon name="add" size={24} color="#fff" />
            <Text style={styles.addButtonText}>Ajouter une catégorie</Text>
          </TouchableOpacity>
        </View>

        {categories.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="category" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>Aucune catégorie</Text>
            <Text style={styles.emptyStateSubtext}>
              Commencez par créer une nouvelle catégorie
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

const getThemedStyles = (theme: ReturnType<typeof useAppTheme>['activeTheme']): StylesType => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  topBar: {
    height: Platform.OS === 'ios' ? 44 : 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    // marginTop sera défini dynamiquement avec useSafeAreaInsets
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginLeft: -8,
  },
  backButtonText: {
    fontSize: 17,
    color: theme.primary,
    marginLeft: -4,
  },
  header: {
    padding: 16,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.text.primary,
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    padding: 12,
    borderRadius: 12,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  addButtonText: {
    color: '#FFFFFF', // Use static white for text on primary button
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  list: {
    padding: 16,
  },
  categoryCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  categoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text.primary,
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 14,
    color: theme.text.secondary,
  },
  categoryActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: theme.primaryLight,
  },
  deleteButton: {
    backgroundColor: theme.danger.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.text.secondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text.secondary,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: theme.text.secondary,
    marginTop: 8,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.background,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    color: theme.danger.main,
    fontSize: 14,
    marginTop: 4,
  },
  retryButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: theme.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF', // Use static white for text on primary button
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CategoryScreen;