import { useCallback, useMemo } from 'react';
import { useContainerPageData } from './useOptimizedSelectors';
import { useCategoriesOptimized as useCategories } from './useCategoriesOptimized';
import type { Item } from '../types/item';
import type { Category } from '../types/category';
import { startOfWeek, startOfMonth, startOfYear, endOfWeek, endOfMonth, eachDayOfInterval, eachMonthOfInterval, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as Sentry from '@sentry/react-native';

export interface Stats {
  totalItems: number;
  availableItems: number;
  soldItems: number;
  totalPurchaseValue: number;
  totalSellingValue: number;
  totalProfit: number;
  averageProfit: number;
  averageMarginPercentage: number;
  // 🆕 NOUVELLES STATS - Articles en stock
  availableItemsStats: {
    count: number;
    totalPurchaseValue: number;
    totalSellingValue: number;
    potentialProfit: number;
  };
  // 🆕 NOUVELLES STATS - Articles vendus
  soldItemsStats: {
    count: number;
    totalPurchaseValue: number;
    totalSellingValue: number;
    actualProfit: number;
  };
  bestSellingItem: {
    name: string;
    profit: number;
    margin: number;
  } | null;
  worstSellingItem: {
    name: string;
    profit: number;
    margin: number;
  } | null;
  categoryStats: {
    categoryId: number;
    categoryName: string;
    itemCount: number;
    totalProfit: number;
    averageMargin: number;
  }[];
}

export interface TimeSeriesDataPoint {
  x: Date;
  y: number;
}

export interface PeriodStats {
  revenue: TimeSeriesDataPoint[];
  profit: TimeSeriesDataPoint[];
  // Totaux corrects pour la période
  totalRevenueForPeriod: number;
  totalProfitForPeriod: number;
  // Données journalières/périodiques (non cumulatives)
  dailyRevenue: TimeSeriesDataPoint[];
  dailyProfit: TimeSeriesDataPoint[];
}

export const useStats = (selectedPeriod: 'week' | 'month' | 'year') => {

  const calculateStats = useCallback((items: Item[], categories: Category[]): Stats => {
    try {
      const availableItems = items.filter(item => item.status === 'available');
      const soldItems = items.filter(item => item.status === 'sold');

      const totalPurchaseValue = items.reduce((sum, item) => sum + item.purchasePrice, 0);
      const totalSellingValue = items.reduce((sum, item) => sum + item.sellingPrice, 0);
      const totalProfit = totalSellingValue - totalPurchaseValue;

      // 🆕 CALCUL STATS ARTICLES DISPONIBLES
      const availableItemsStats = {
        count: availableItems.length,
        totalPurchaseValue: availableItems.reduce((sum, item) => sum + item.purchasePrice, 0),
        totalSellingValue: availableItems.reduce((sum, item) => sum + item.sellingPrice, 0),
        potentialProfit: availableItems.reduce((sum, item) => sum + (item.sellingPrice - item.purchasePrice), 0),
      };

      // 🆕 CALCUL STATS ARTICLES VENDUS
      const soldItemsStats = {
        count: soldItems.length,
        totalPurchaseValue: soldItems.reduce((sum, item) => sum + item.purchasePrice, 0),
        totalSellingValue: soldItems.reduce((sum, item) => sum + item.sellingPrice, 0),
        actualProfit: soldItems.reduce((sum, item) => sum + (item.sellingPrice - item.purchasePrice), 0),
      };

      // Calcul du profit réel sur les articles vendus uniquement
      const soldItemsProfit = soldItems.reduce((sum, item) => 
        sum + (item.sellingPrice - item.purchasePrice), 0);

      const itemsWithMargins = soldItems.map(item => ({
        ...item,
        profit: item.sellingPrice - item.purchasePrice,
        margin: item.sellingPrice > 0 ? ((item.sellingPrice - item.purchasePrice) / item.sellingPrice) * 100 : 0
      }));

      const bestSellingItem = itemsWithMargins.length > 0
        ? itemsWithMargins.reduce((best, current) => 
            current.profit > best.profit ? current : best
          )
        : null;

      const worstSellingItem = itemsWithMargins.length > 0
        ? itemsWithMargins.reduce((worst, current) => 
            current.profit < worst.profit ? current : worst
          )
        : null;

      const categoryStats = categories.map(category => {
        const categoryItems = items.filter(item => item.categoryId === category.id);
        const categoryProfit = categoryItems.reduce((sum, item) => 
          sum + (item.sellingPrice - item.purchasePrice), 0);
        const categoryRevenue = categoryItems.reduce((sum, item) => 
          sum + item.sellingPrice, 0);

        const result = {
          categoryId: category.id,
          categoryName: category.name,
          itemCount: categoryItems.length,
          totalProfit: categoryProfit,
          averageMargin: categoryRevenue > 0 
            ? (categoryProfit / categoryRevenue) * 100 
            : 0
        };



        return result;
      });

      return {
        totalItems: items.length,
        availableItems: availableItems.length,
        soldItems: soldItems.length,
        totalPurchaseValue,
        totalSellingValue,
        totalProfit,
        availableItemsStats, // 🆕
        soldItemsStats, // 🆕
        averageProfit: soldItems.length > 0 ? soldItemsProfit / soldItems.length : 0,
        averageMarginPercentage: soldItems.length > 0 
          ? (itemsWithMargins.reduce((sum, item) => sum + item.margin, 0) / soldItems.length)
          : 0,
        bestSellingItem: bestSellingItem ? {
          name: bestSellingItem.name,
          profit: bestSellingItem.profit,
          margin: bestSellingItem.margin
        } : null,
        worstSellingItem: worstSellingItem ? {
          name: worstSellingItem.name,
          profit: worstSellingItem.profit,
          margin: worstSellingItem.margin
        } : null,
        categoryStats
      };
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          section: 'stats_calculation'
        }
      });
      throw error;
    }
  }, []);

  const calculatePeriodStats = useCallback((items: Item[]): PeriodStats => {
    try {
      const now = new Date();
      let startDate: Date;
      let endDate: Date = now;
      let dateInterval: Date[] = [];

      switch (selectedPeriod) {
        case 'week':
          startDate = startOfWeek(now, { locale: fr, weekStartsOn: 1 });
          endDate = endOfWeek(now, { locale: fr, weekStartsOn: 1 });
          dateInterval = eachDayOfInterval({ start: startDate, end: endDate });
          break;
        case 'month':
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          dateInterval = eachDayOfInterval({ start: startDate, end: now });
          break;
        case 'year':
          startDate = startOfYear(now);
          endDate = now;
          dateInterval = eachMonthOfInterval({ start: startDate, end: now });
          break;
        default:
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          dateInterval = eachDayOfInterval({ start: startDate, end: now });
      }

      // Filtrer les articles vendus dans la période
      const soldItemsInPeriod = items.filter(item => {
        if (item.status !== 'sold' || !item.soldAt) return false;
        try {
          const soldDate = new Date(item.soldAt);
          return soldDate >= startDate && soldDate <= endDate;
        } catch (error) {
          console.error(`[useStats] Error parsing date for item ${item.name}: ${item.soldAt}`, error);
          Sentry.captureException(error, {
            tags: {
              section: 'period_stats_date_parsing'
            }
          });
          return false;
        }
      }).sort((a, b) => new Date(a.soldAt!).getTime() - new Date(b.soldAt!).getTime());

      // 🔧 CORRECTION MAJEURE : Calculer les totaux réels de la période (pas cumulatifs)
      const totalRevenueForPeriod = soldItemsInPeriod.reduce((sum, item) => sum + (item.sellingPrice || 0), 0);
      const totalProfitForPeriod = soldItemsInPeriod.reduce((sum, item) => 
        sum + ((item.sellingPrice || 0) - (item.purchasePrice || 0)), 0);

      console.log(`[useStats] Période ${selectedPeriod}:`, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        soldItemsCount: soldItemsInPeriod.length,
        totalRevenueForPeriod,
        totalProfitForPeriod,
        soldItems: soldItemsInPeriod.map(item => ({
          name: item.name,
          soldAt: item.soldAt,
          sellingPrice: item.sellingPrice,
          purchasePrice: item.purchasePrice
        }))
      });

      // Données cumulatives pour le graphique de tendance
      const cumulativeRevenueData: TimeSeriesDataPoint[] = [];
      const cumulativeProfitData: TimeSeriesDataPoint[] = [];
      
      // Données journalières/périodiques (non cumulatives)
      const dailyRevenueData: TimeSeriesDataPoint[] = [];
      const dailyProfitData: TimeSeriesDataPoint[] = [];

      let cumulativeRevenue = 0;
      let cumulativeProfit = 0;
      let itemIndex = 0;

      dateInterval.forEach((datePoint, index) => {
        const thresholdDate = selectedPeriod === 'year' && index === dateInterval.length - 1
          ? now 
          : endOfDay(selectedPeriod === 'year' ? endOfMonth(datePoint) : datePoint);

        // Calculer le CA/profit du jour/période actuel UNIQUEMENT
        let periodRevenue = 0;
        let periodProfit = 0;
        
        // Compter seulement les items vendus CE jour/période
        const itemsThisPeriod = soldItemsInPeriod.filter(item => {
          const itemSoldDate = new Date(item.soldAt!);
          if (selectedPeriod === 'year') {
            // Pour l'année, comparer les mois
            return itemSoldDate.getFullYear() === datePoint.getFullYear() && 
                   itemSoldDate.getMonth() === datePoint.getMonth();
          } else {
            // Pour semaine/mois, comparer les jours
            return itemSoldDate.getFullYear() === datePoint.getFullYear() &&
                   itemSoldDate.getMonth() === datePoint.getMonth() &&
                   itemSoldDate.getDate() === datePoint.getDate();
          }
        });

        itemsThisPeriod.forEach(item => {
          const revenue = item.sellingPrice || 0;
          const profit = revenue - (item.purchasePrice || 0);
          periodRevenue += revenue;
          periodProfit += profit;
        });

        // Ajouter au cumulatif pour le graphique
        cumulativeRevenue += periodRevenue;
        cumulativeProfit += periodProfit;

        // Données cumulatives pour le graphique de tendance
        cumulativeRevenueData.push({
          x: datePoint,
          y: cumulativeRevenue
        });
        cumulativeProfitData.push({
          x: datePoint,
          y: cumulativeProfit
        });

        // Données journalières/périodiques pour analyses détaillées
        dailyRevenueData.push({
          x: datePoint,
          y: periodRevenue
        });
        dailyProfitData.push({
          x: datePoint,
          y: periodProfit
        });
      });

      return {
        revenue: cumulativeRevenueData,
        profit: cumulativeProfitData,
        totalRevenueForPeriod,
        totalProfitForPeriod,
        dailyRevenue: dailyRevenueData,
        dailyProfit: dailyProfitData
      };

    } catch (error) {
      console.error('[useStats] Error in calculatePeriodStats:', error);
      Sentry.captureException(error, {
        tags: {
          section: 'period_stats'
        }
      });
      throw error;
    }
  }, [selectedPeriod]);

  const { items = [], error: itemsError } = useContainerPageData();
  const { categories = [], error: categoriesError } = useCategories();



  const stats = useMemo(() => {
    if (itemsError || categoriesError) {
      Sentry.captureException(itemsError || categoriesError, {
        tags: {
          section: 'stats',
          action: 'calculate_stats'
        },
        extra: {
          period: selectedPeriod,
          itemCount: items.length,
          categoryCount: categories.length
        }
      });
      throw new Error('Erreur lors du calcul des statistiques');
    }
    return calculateStats(items, categories);
  }, [items, categories, calculateStats, itemsError, categoriesError, selectedPeriod]);

  const periodStats = useMemo(() => {
    if (itemsError) {
      Sentry.captureException(itemsError, {
        tags: {
          section: 'stats',
          action: 'calculate_period_stats'
        },
        extra: {
          period: selectedPeriod,
          itemCount: items.length
        }
      });
      throw new Error('Erreur lors du calcul des statistiques de période');
    }
    return calculatePeriodStats(items);
  }, [items, calculatePeriodStats, itemsError, selectedPeriod]);

  return {
    stats,
    monthlyStats: periodStats, // Garder la compatibilité avec l'ancien nom
    periodStats,
    isLoading: false,
    error: itemsError || categoriesError
  };
}; 