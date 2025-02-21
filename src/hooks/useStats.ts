import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { database } from '../database/database';
import type { Item } from '../types/item';
import type { Category } from '../types/category';
import { format, subWeeks, subMonths, subYears } from 'date-fns';
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

export interface MonthlyStats {
  month: string;
  revenue: number;
  profit: number;
  itemCount: number;
}

export const useStats = (selectedPeriod: 'week' | 'month' | 'year') => {

  const calculateStats = useCallback((items: Item[], categories: Category[]): Stats => {
    try {
      const availableItems = items.filter(item => item.status === 'available');
      const soldItems = items.filter(item => item.status === 'sold');

      const totalPurchaseValue = items.reduce((sum, item) => sum + item.purchasePrice, 0);
      const totalSellingValue = items.reduce((sum, item) => sum + item.sellingPrice, 0);
      const totalProfit = totalSellingValue - totalPurchaseValue;

      const itemsWithMargins = soldItems.map(item => ({
        ...item,
        profit: item.sellingPrice - item.purchasePrice,
        margin: ((item.sellingPrice - item.purchasePrice) / item.purchasePrice) * 100
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

        return {
          categoryId: category.id,
          categoryName: category.name,
          itemCount: categoryItems.length,
          totalProfit: categoryProfit,
          averageMargin: categoryItems.length > 0 
            ? (categoryProfit / categoryRevenue) * 100 
            : 0
        };
      });

      return {
        totalItems: items.length,
        availableItems: availableItems.length,
        soldItems: soldItems.length,
        totalPurchaseValue,
        totalSellingValue,
        totalProfit,
        averageProfit: soldItems.length > 0 ? totalProfit / soldItems.length : 0,
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

  const calculateMonthlyStats = useCallback((items: Item[]): MonthlyStats[] => {
    try {
      const now = new Date();
      let startDate: Date;

      switch (selectedPeriod) {
        case 'week':
          startDate = subWeeks(now, 1);
          break;
        case 'month':
          startDate = subMonths(now, 1);
          break;
        case 'year':
          startDate = subYears(now, 1);
          break;
        default:
          startDate = subMonths(now, 1);
      }

      const soldItems = items.filter(item => {
        if (item.status !== 'sold' || !item.soldAt) return false;
        try {
          const soldDate = new Date(item.soldAt);
          return soldDate >= startDate && soldDate <= now;
        } catch (error) {
          Sentry.captureException(error, {
            tags: {
              section: 'monthly_stats_date_parsing'
            }
          });
          return false;
        }
      });

      const stats: { [key: string]: MonthlyStats } = {};

      soldItems.forEach(item => {
        if (!item.soldAt) return;

        try {
          const soldDate = new Date(item.soldAt);
          let key: string;
          
          switch (selectedPeriod) {
            case 'week':
              key = format(soldDate, 'EEE', { locale: fr }).toLowerCase();
              break;
            case 'month':
              key = format(soldDate, 'dd/MM', { locale: fr });
              break;
            case 'year':
              key = format(soldDate, 'MMM', { locale: fr }).toLowerCase();
              break;
          }

          if (!stats[key]) {
            stats[key] = {
              month: key,
              revenue: 0,
              profit: 0,
              itemCount: 0
            };
          }

          stats[key].revenue += item.sellingPrice || 0;
          stats[key].profit += (item.sellingPrice || 0) - (item.purchasePrice || 0);
          stats[key].itemCount += 1;
        } catch (error) {
          Sentry.captureException(error, {
            tags: {
              section: 'monthly_stats_calculation'
            }
          });
        }
      });

      const sortedStats = Object.values(stats).sort((a, b) => {
        if (selectedPeriod === 'week') {
          const weekDays = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
          return weekDays.indexOf(a.month) - weekDays.indexOf(b.month);
        }
        return a.month.localeCompare(b.month);
      });

      return sortedStats;
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          section: 'monthly_stats'
        }
      });
      throw error;
    }
  }, [selectedPeriod]);

  const { data: items = [], error: itemsError } = useQuery({
    queryKey: ['items'],
    queryFn: () => database.getItems(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 24 * 60 * 60 * 1000 // 24 heures
  });

  const { data: categories = [], error: categoriesError } = useQuery({
    queryKey: ['categories'],
    queryFn: () => database.getCategories(),
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 24 * 60 * 60 * 1000 // 24 heures
  });

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

  const monthlyStats = useMemo(() => {
    if (itemsError) {
      Sentry.captureException(itemsError, {
        tags: {
          section: 'stats',
          action: 'calculate_monthly_stats'
        },
        extra: {
          period: selectedPeriod,
          itemCount: items.length
        }
      });
      throw new Error('Erreur lors du calcul des statistiques mensuelles');
    }
    return calculateMonthlyStats(items);
  }, [items, calculateMonthlyStats, itemsError, selectedPeriod]);

  return {
    stats,
    monthlyStats,
    isLoading: false,
    error: itemsError || categoriesError
  };
}; 