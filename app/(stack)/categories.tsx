import React, { useCallback, type FC } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  type ViewStyle,
  type TextStyle
} from 'react-native';
import type { Category } from '../../src/types/category';
import { MaterialIcons } from '@expo/vector-icons';
import type { MaterialIconName } from '../../src/types/icons';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useCategories } from '../../src/hooks/useCategories';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { validateCategory } from '../../src/utils/validation';
import { checkNetworkConnection } from '../../src/utils/networkUtils';
import Toast from 'react-native-toast-message';
import * as Sentry from '@sentry/react-native';

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
  onDelete 
}) => {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(1) }],
    opacity: withSpring(1)
  }));

  return (
    <Animated.View style={[styles.categoryCard, animatedStyle]}>
      <View style={styles.categoryContent}>
        <View style={styles.iconContainer}>
          <MaterialIcons
            name={(category.icon as MaterialIconName) || 'folder'}
            size={24}
            color="#007AFF"
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
          <MaterialIcons name="edit" size={20} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => onDelete(category)}
        >
          <MaterialIcons name="delete" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

const CategoryScreen: FC = () => {
  const router = useRouter();
  const { categories, isLoading, error, handleDeleteCategory } = useCategories();

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

  const confirmDeleteCategory = useCallback(async (category: Category) => {
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

    Alert.alert(
      'Supprimer la catégorie',
      `Êtes-vous sûr de vouloir supprimer "${category.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await handleDeleteCategory(category.id);
              Toast.show({
                type: 'success',
                text1: 'Succès',
                text2: 'Catégorie supprimée avec succès'
              });
            } catch (error) {
              Sentry.captureException(error, {
                extra: {
                  categoryId: category.id,
                  categoryName: category.name,
                  action: 'delete_category'
                }
              });
              Toast.show({
                type: 'error',
                text1: 'Erreur de suppression',
                text2: 'Impossible de supprimer la catégorie'
              });
            }
          }
        }
      ]
    );
  }, [handleDeleteCategory]);

  const renderItem = useCallback(({ item }: { item: Category }) => (
    <CategoryCard 
      category={item} 
      onEdit={handleEditCategory} 
      onDelete={confirmDeleteCategory}
    />
  ), [handleEditCategory, confirmDeleteCategory]);

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
        <MaterialIcons name="error-outline" size={64} color="#FF3B30" />
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
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.push('/(stack)/settings')}
          >
            <MaterialIcons name="arrow-back-ios" size={18} color="#007AFF" />
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Catégories</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddCategory}
          >
            <MaterialIcons name="add" size={24} color="#fff" />
            <Text style={styles.addButtonText}>Ajouter une catégorie</Text>
          </TouchableOpacity>
        </View>

        {categories.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="category" size={64} color="#ccc" />
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
      </SafeAreaView>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create<StylesType>({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  topBar: {
    height: Platform.OS === 'ios' ? 44 : 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    marginTop: Platform.OS === 'ios' ? 47 : 0,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginLeft: -8,
  },
  backButtonText: {
    fontSize: 17,
    color: '#007AFF',
    marginLeft: -4,
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  list: {
    padding: 16,
  },
  categoryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  categoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F8FF',
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
    color: '#333',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 14,
    color: '#666',
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
    backgroundColor: '#F0F8FF',
  },
  deleteButton: {
    backgroundColor: '#FFF0F0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
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
    color: '#666',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 4,
  },
  retryButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CategoryScreen;