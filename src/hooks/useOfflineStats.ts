import { useState, useEffect, useCallback } from 'react';
import { localDB } from '../database/localDatabase';
import { useNetwork } from '../contexts/NetworkContext';

interface OfflineStats {
  // Statistiques générales
  totalItems: number;
  totalContainers: number;
  totalCategories: number;
  
  // Statistiques des items
  availableItems: number;
  soldItems: number;
  totalValue: number;
  averagePrice: number;
  
  // Statistiques par statut de synchronisation
  syncedItems: number;
  pendingItems: number;
  offlineItems: number;
  
  // Statistiques des containers
  emptyContainers: number;
  fullContainers: number;
  averageItemsPerContainer: number;
  
  // Statistiques temporelles
  itemsCreatedToday: number;
  itemsSoldToday: number;
  itemsCreatedThisWeek: number;
  itemsSoldThisWeek: number;
  
  // Métadonnées
  lastUpdated: Date;
  dataSource: 'cache' | 'local' | 'mixed';
  isOfflineOnly: boolean;
}

interface CategoryStats {
  id: number | string;
  name: string;
  totalItems: number;
  availableItems: number;
  soldItems: number;
  totalValue: number;
  averagePrice: number;
}

interface ContainerStats {
  id: number | string;
  name: string;
  number: number;
  totalItems: number;
  totalValue: number;
  lastItemAdded?: Date;
  isEmpty: boolean;
}

interface SalesStats {
  totalSales: number;
  totalRevenue: number;
  averageSalePrice: number;
  bestSellingCategory?: string;
  salesByDay: { date: string; count: number; revenue: number }[];
  salesByCategory: { category: string; count: number; revenue: number }[];
}

interface UseOfflineStatsReturn {
  // État
  stats: OfflineStats | null;
  categoryStats: CategoryStats[];
  containerStats: ContainerStats[];
  salesStats: SalesStats | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  refreshStats: () => Promise<void>;
  calculateStatsForPeriod: (startDate: Date, endDate: Date) => Promise<OfflineStats>;
  getTopSellingItems: (limit?: number) => Promise<any[]>;
  getLowStockItems: (threshold?: number) => Promise<any[]>;
  getRecentActivity: (limit?: number) => Promise<any[]>;
}

export function useOfflineStats(): UseOfflineStatsReturn {
  const [stats, setStats] = useState<OfflineStats | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [containerStats, setContainerStats] = useState<ContainerStats[]>([]);
  const [salesStats, setSalesStats] = useState<SalesStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { isOnline } = useNetwork();

  /**
   * Calculer les statistiques principales
   */
  const calculateMainStats = useCallback(async (): Promise<OfflineStats> => {
    const [items, containers, categories] = await Promise.all([
      localDB.items.toArray(),
      localDB.containers.toArray(),
      localDB.categories.toArray()
    ]);

    // Statistiques générales
    const totalItems = items.length;
    const totalContainers = containers.length;
    const totalCategories = categories.length;

    // Statistiques des items
    const availableItems = items.filter(item => item.status === 'available').length;
    const soldItems = items.filter(item => item.status === 'sold').length;
    const totalValue = items
      .filter(item => item.status === 'available')
      .reduce((sum, item) => sum + (item.sellingPrice || 0), 0);
    const averagePrice = availableItems > 0 ? totalValue / availableItems : 0;

    // Statistiques de synchronisation
    const syncedItems = items.filter(item => item.syncStatus === 'synced').length;
    const pendingItems = items.filter(item => item.syncStatus === 'pending').length;
    const offlineItems = items.filter(item => item.isOffline).length;

    // Statistiques des containers
    const itemsPerContainer = new Map<number | string, number>();
    items.forEach(item => {
      if (item.containerId) {
        itemsPerContainer.set(
          item.containerId,
          (itemsPerContainer.get(item.containerId) || 0) + 1
        );
      }
    });

    const emptyContainers = containers.filter(c => !itemsPerContainer.has(c.id)).length;
    const fullContainers = containers.length - emptyContainers;
    const averageItemsPerContainer = fullContainers > 0 
      ? Array.from(itemsPerContainer.values()).reduce((sum, count) => sum + count, 0) / fullContainers
      : 0;

    // Statistiques temporelles
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const itemsCreatedToday = items.filter(item => {
      const createdAt = new Date(item.createdAt);
      return createdAt >= today;
    }).length;

    const itemsSoldToday = items.filter(item => {
      if (item.status !== 'sold' || !item.soldAt) return false;
      const soldAt = new Date(item.soldAt);
      return soldAt >= today;
    }).length;

    const itemsCreatedThisWeek = items.filter(item => {
      const createdAt = new Date(item.createdAt);
      return createdAt >= oneWeekAgo;
    }).length;

    const itemsSoldThisWeek = items.filter(item => {
      if (item.status !== 'sold' || !item.soldAt) return false;
      const soldAt = new Date(item.soldAt);
      return soldAt >= oneWeekAgo;
    }).length;

    return {
      totalItems,
      totalContainers,
      totalCategories,
      availableItems,
      soldItems,
      totalValue,
      averagePrice,
      syncedItems,
      pendingItems,
      offlineItems,
      emptyContainers,
      fullContainers,
      averageItemsPerContainer,
      itemsCreatedToday,
      itemsSoldToday,
      itemsCreatedThisWeek,
      itemsSoldThisWeek,
      lastUpdated: new Date(),
      dataSource: isOnline ? 'mixed' : 'local',
      isOfflineOnly: !isOnline
    };
  }, [isOnline]);

  /**
   * Calculer les statistiques par catégorie
   */
  const calculateCategoryStats = useCallback(async (): Promise<CategoryStats[]> => {
    const [items, categories] = await Promise.all([
      localDB.items.toArray(),
      localDB.categories.toArray()
    ]);

    return categories.map(category => {
      const categoryItems = items.filter(item => item.categoryId === category.id);
      const availableItems = categoryItems.filter(item => item.status === 'available');
      const soldItems = categoryItems.filter(item => item.status === 'sold');
      const totalValue = availableItems.reduce((sum, item) => sum + (item.sellingPrice || 0), 0);
      const averagePrice = availableItems.length > 0 ? totalValue / availableItems.length : 0;

      return {
        id: category.id,
        name: category.name,
        totalItems: categoryItems.length,
        availableItems: availableItems.length,
        soldItems: soldItems.length,
        totalValue,
        averagePrice
      };
    }).filter(stat => stat.totalItems > 0);
  }, []);

  /**
   * Calculer les statistiques par container
   */
  const calculateContainerStats = useCallback(async (): Promise<ContainerStats[]> => {
    const [items, containers] = await Promise.all([
      localDB.items.toArray(),
      localDB.containers.toArray()
    ]);

    return containers.map(container => {
      const containerItems = items.filter(item => item.containerId === container.id);
      const totalValue = containerItems
        .filter(item => item.status === 'available')
        .reduce((sum, item) => sum + (item.sellingPrice || 0), 0);
      
      const lastItemAdded = containerItems.length > 0
        ? new Date(Math.max(...containerItems.map(item => new Date(item.createdAt).getTime())))
        : undefined;

      return {
        id: container.id,
        name: container.name,
        number: container.number,
        totalItems: containerItems.length,
        totalValue,
        lastItemAdded,
        isEmpty: containerItems.length === 0
      };
    }).sort((a, b) => b.totalItems - a.totalItems);
  }, []);

  /**
   * Calculer les statistiques de vente
   */
  const calculateSalesStats = useCallback(async (): Promise<SalesStats> => {
    const [items, categories] = await Promise.all([
      localDB.items.toArray(),
      localDB.categories.toArray()
    ]);

    const soldItems = items.filter(item => item.status === 'sold' && item.soldAt);
    const totalSales = soldItems.length;
    const totalRevenue = soldItems.reduce((sum, item) => sum + (item.sellingPrice || 0), 0);
    const averageSalePrice = totalSales > 0 ? totalRevenue / totalSales : 0;

    // Ventes par jour (30 derniers jours)
    const salesByDay: { date: string; count: number; revenue: number }[] = [];
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date;
    }).reverse();

    last30Days.forEach(date => {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const daySales = soldItems.filter(item => {
        const soldAt = new Date(item.soldAt!);
        return soldAt >= dayStart && soldAt <= dayEnd;
      });

      salesByDay.push({
        date: date.toISOString().split('T')[0],
        count: daySales.length,
        revenue: daySales.reduce((sum, item) => sum + (item.sellingPrice || 0), 0)
      });
    });

    // Ventes par catégorie
    const salesByCategory = categories.map(category => {
      const categorySales = soldItems.filter(item => item.categoryId === category.id);
      return {
        category: category.name,
        count: categorySales.length,
        revenue: categorySales.reduce((sum, item) => sum + (item.sellingPrice || 0), 0)
      };
    }).filter(stat => stat.count > 0)
      .sort((a, b) => b.count - a.count);

    const bestSellingCategory = salesByCategory.length > 0 ? salesByCategory[0].category : undefined;

    return {
      totalSales,
      totalRevenue,
      averageSalePrice,
      bestSellingCategory,
      salesByDay,
      salesByCategory
    };
  }, []);

  /**
   * Rafraîchir toutes les statistiques
   */
  const refreshStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [mainStats, catStats, contStats, saleStats] = await Promise.all([
        calculateMainStats(),
        calculateCategoryStats(),
        calculateContainerStats(),
        calculateSalesStats()
      ]);

      setStats(mainStats);
      setCategoryStats(catStats);
      setContainerStats(contStats);
      setSalesStats(saleStats);

      console.log('[useOfflineStats] Statistiques mises à jour:', {
        totalItems: mainStats.totalItems,
        totalContainers: mainStats.totalContainers,
        totalValue: mainStats.totalValue,
        dataSource: mainStats.dataSource
      });

    } catch (error: any) {
      console.error('[useOfflineStats] Erreur calcul statistiques:', error);
      setError(error.message || 'Erreur lors du calcul des statistiques');
    } finally {
      setIsLoading(false);
    }
  }, [calculateMainStats, calculateCategoryStats, calculateContainerStats, calculateSalesStats]);

  /**
   * Calculer les statistiques pour une période donnée
   */
  const calculateStatsForPeriod = useCallback(async (
    startDate: Date,
    endDate: Date
  ): Promise<OfflineStats> => {
    const items = await localDB.items
      .where('createdAt')
      .between(startDate.toISOString(), endDate.toISOString())
      .toArray();

    // Utiliser la même logique que calculateMainStats mais avec les items filtrés
    const totalItems = items.length;
    const availableItems = items.filter(item => item.status === 'available').length;
    const soldItems = items.filter(item => item.status === 'sold').length;
    const totalValue = items
      .filter(item => item.status === 'available')
      .reduce((sum, item) => sum + (item.sellingPrice || 0), 0);

    // Statistiques basiques pour la période
    return {
      totalItems,
      totalContainers: 0, // Les containers ne sont pas filtrés par période
      totalCategories: 0,
      availableItems,
      soldItems,
      totalValue,
      averagePrice: availableItems > 0 ? totalValue / availableItems : 0,
      syncedItems: items.filter(item => item.syncStatus === 'synced').length,
      pendingItems: items.filter(item => item.syncStatus === 'pending').length,
      offlineItems: items.filter(item => item.isOffline).length,
      emptyContainers: 0,
      fullContainers: 0,
      averageItemsPerContainer: 0,
      itemsCreatedToday: 0,
      itemsSoldToday: 0,
      itemsCreatedThisWeek: 0,
      itemsSoldThisWeek: 0,
      lastUpdated: new Date(),
      dataSource: 'local',
      isOfflineOnly: !isOnline
    };
  }, [isOnline]);

  /**
   * Obtenir les articles les plus vendus
   */
  const getTopSellingItems = useCallback(async (limit: number = 10): Promise<any[]> => {
    const items = await localDB.items
      .where('status')
      .equals('sold')
      .reverse()
      .limit(limit)
      .toArray();

    return items.sort((a, b) => (b.sellingPrice || 0) - (a.sellingPrice || 0));
  }, []);

  /**
   * Obtenir les articles avec stock bas
   */
  const getLowStockItems = useCallback(async (threshold: number = 5): Promise<any[]> => {
    // Cette fonction nécessiterait un champ "quantity" dans les items
    // Pour l'instant, retourner les items sans container (considérés comme stock bas)
    const items = await localDB.items
      .filter(item => 
        (item.containerId === null || item.containerId === undefined) &&
        item.status === 'available'
      )
      .toArray();

    return items.slice(0, threshold);
  }, []);

  /**
   * Obtenir l'activité récente
   */
  const getRecentActivity = useCallback(async (limit: number = 20): Promise<any[]> => {
    const recentItems = await localDB.items
      .orderBy('updatedAt')
      .reverse()
      .limit(limit)
      .toArray();

    return recentItems.map(item => ({
      id: item.id,
      name: item.name,
      action: item.status === 'sold' ? 'Vendu' : 'Modifié',
      timestamp: item.updatedAt,
      isOffline: item.isOffline
    }));
  }, []);

  // Rafraîchir automatiquement au chargement
  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  // Rafraîchir quand le statut réseau change
  useEffect(() => {
    refreshStats();
  }, [isOnline, refreshStats]);

  return {
    stats,
    categoryStats,
    containerStats,
    salesStats,
    isLoading,
    error,
    refreshStats,
    calculateStatsForPeriod,
    getTopSellingItems,
    getLowStockItems,
    getRecentActivity
  };
}