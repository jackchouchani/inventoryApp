import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { selectCategoryById } from '../../../src/store/categorySlice';
import { RootState, AppDispatch } from '../../../src/store/store';
import { useAppTheme } from '../../../src/contexts/ThemeContext';
import { ErrorBoundary } from '../../../src/components/ErrorBoundary';
import { Icon, CommonHeader } from '../../../src/components';
import VirtualizedItemList from '../../../src/components/VirtualizedItemList';
import { useAllCategories, useAllContainers } from '../../../src/hooks/useOptimizedSelectors';
import { selectAllItems } from '../../../src/store/selectors';
import { fetchItems } from '../../../src/store/itemsThunks';
import type { Item } from '../../../src/types/item';
import StyleFactory from '../../../src/styles/StyleFactory';
import Toast from 'react-native-toast-message';
import { updateItemStatus } from '../../../src/store/itemsThunks';

export default function CategoryContentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { activeTheme } = useAppTheme();
  
  const categoryId = id ? parseInt(id, 10) : null;
  const category = useSelector((state: RootState) => 
    categoryId ? selectCategoryById(state, categoryId) : null
  );

  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'CategoryContent');

  // ✅ CHARGEMENT DE TOUS LES ITEMS - Pattern similaire à useContainerPageData
  const allItems = useSelector(selectAllItems);
  const categories = useAllCategories();
  const containers = useAllContainers();
  const { totalItems, hasMore } = useSelector((state: RootState) => state.items);

  // Force le chargement de TOUS les items si ce n'est pas déjà fait
  useEffect(() => {
    const loadAllItems = async () => {
      if (hasMore && allItems.length < totalItems) {
        console.log('[CategoryContent] Chargement de TOUS les items pour catégorie');
        try {
          await dispatch(fetchItems({ page: 0, limit: 10000 })).unwrap();
        } catch (error) {
          console.error('[CategoryContent] Erreur chargement items:', error);
        }
      }
    };

    loadAllItems();
  }, [dispatch, hasMore, allItems.length, totalItems]);

  // ✅ FILTRAGE - Articles de la catégorie spécifique
  const filteredItems = useMemo(() => {
    if (!categoryId) return [];
    
    return allItems.filter(item => item.categoryId === categoryId);
  }, [allItems, categoryId]);

  // États de chargement
  const [isMarkingAsSold, setIsMarkingAsSold] = useState<string | null>(null);
  const [isMarkingAsAvailable, setIsMarkingAsAvailable] = useState<string | null>(null);

  // Navigation vers les détails d'un article
  const handleItemPress = useCallback((item: Item) => {
    router.push(`/item/${item.id}/info`);
  }, [router]);

  // Marquer un article comme vendu
  const handleMarkAsSold = useCallback(async (item: Item) => {
    const itemIdString = item.id.toString();
    if (isMarkingAsSold === itemIdString) return;
    
    try {
      setIsMarkingAsSold(itemIdString);
      
      // ✅ CORRECTION TYPE - Conversion en number
      await dispatch(updateItemStatus({ 
        itemId: item.id, // Déjà un number
        status: 'sold'
      })).unwrap();

      Toast.show({
        type: 'success',
        text1: 'Succès',
        text2: `"${item.name}" marqué comme vendu`
      });
    } catch (error) {
      console.error('Erreur lors du marquage comme vendu:', error);
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de marquer l\'article comme vendu'
      });
    } finally {
      setIsMarkingAsSold(null);
    }
  }, [dispatch, isMarkingAsSold]);

  // Marquer un article comme disponible
  const handleMarkAsAvailable = useCallback(async (item: Item) => {
    const itemIdString = item.id.toString();
    if (isMarkingAsAvailable === itemIdString) return;
    
    try {
      setIsMarkingAsAvailable(itemIdString);
      
      // ✅ CORRECTION TYPE - Conversion en number
      await dispatch(updateItemStatus({ 
        itemId: item.id, // Déjà un number
        status: 'available'
      })).unwrap();

      Toast.show({
        type: 'success',
        text1: 'Succès',
        text2: `"${item.name}" marqué comme disponible`
      });
    } catch (error) {
      console.error('Erreur lors du marquage comme disponible:', error);
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de marquer l\'article comme disponible'
      });
    } finally {
      setIsMarkingAsAvailable(null);
    }
  }, [dispatch, isMarkingAsAvailable]);

  // Navigation vers l'édition de la catégorie
  const handleEditCategory = useCallback(() => {
    if (categoryId) {
      router.push(`/category/${categoryId}/edit`);
    }
  }, [router, categoryId]);

  // Gestion d'erreur pour ID invalide
  if (!categoryId || isNaN(categoryId)) {
    return (
      <ErrorBoundary>
        <View style={styles.container}>
          <CommonHeader 
            title="Erreur"
            onBackPress={() => router.back()}
          />
          <View style={styles.errorContainer}>
            <Icon name="error" size={48} color={activeTheme.danger.main} />
            <Text style={styles.errorTitle}>ID de catégorie invalide</Text>
            <Text style={styles.errorText}>L'ID fourni n'est pas valide</Text>
          </View>
        </View>
      </ErrorBoundary>
    );
  }

  // Gestion du chargement
  if (!category) {
    return (
      <ErrorBoundary>
        <View style={styles.container}>
          <CommonHeader 
            title="Chargement..."
            onBackPress={() => router.back()}
          />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={activeTheme.primary} />
            <Text style={styles.loadingText}>Chargement de la catégorie...</Text>
          </View>
        </View>
      </ErrorBoundary>
    );
  }

  const availableCount = filteredItems.filter(item => item.status === 'available').length;
  const soldCount = filteredItems.filter(item => item.status === 'sold').length;

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        {/* ✅ COMMONHEADER - Header avec titre dynamique */}
        <CommonHeader 
          title={category.name}
          onBackPress={() => router.back()}
          rightComponent={
            <TouchableOpacity onPress={handleEditCategory}>
              <Icon name="edit" size={24} color={activeTheme.primary} />
            </TouchableOpacity>
          }
        />

        {/* Informations de la catégorie */}
        <View style={styles.categoryInfoContainer}>
          <View style={styles.categoryHeader}>
            <View style={styles.categoryIconContainer}>
              <Icon
                name={category.icon || 'folder'}
                size={32}
                color={activeTheme.primary}
              />
            </View>
            <View style={styles.categoryDetails}>
              <Text style={styles.categoryName}>{category.name}</Text>
              {category.description ? (
                <Text style={styles.categoryDescription}>{category.description}</Text>
              ) : null}
            </View>
          </View>

          {/* Statistiques */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{filteredItems.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: activeTheme.success }]}>{availableCount}</Text>
              <Text style={styles.statLabel}>Disponibles</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: activeTheme.text.secondary }]}>{soldCount}</Text>
              <Text style={styles.statLabel}>Vendus</Text>
            </View>
          </View>
        </View>

        {/* Liste des articles */}
        {filteredItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="inventory" size={64} color={activeTheme.text.secondary} />
            <Text style={styles.emptyStateText}>Aucun article dans cette catégorie</Text>
            <Text style={styles.emptyStateSubtext}>
              Commencez par ajouter des articles à cette catégorie
            </Text>
          </View>
        ) : (
          <VirtualizedItemList
            items={filteredItems}
            categories={categories}
            containers={containers}
            onItemPress={handleItemPress}
            onMarkAsSold={handleMarkAsSold}
            onMarkAsAvailable={handleMarkAsAvailable}
            estimatedItemSize={120}
          />
        )}
      </View>
    </ErrorBoundary>
  );
} 