import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { database } from '../database/database';
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

export interface TimeSeriesDataPoint {
  x: Date;
  y: number;
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

  const calculateMonthlyStats = useCallback((items: Item[]) => {
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

      const soldItems = items.filter(item => {
        if (item.status !== 'sold' || !item.soldAt) return false;
        try {
          const soldDate = new Date(item.soldAt);
          return soldDate >= startDate && soldDate <= endDate;
        } catch (error) {
          console.error(`[useStats] Error parsing date for item ${item.name}: ${item.soldAt}`, error);
          Sentry.captureException(error, {
            tags: {
              section: 'monthly_stats_date_parsing'
            }
          });
          return false;
        }
      }).sort((a, b) => new Date(a.soldAt!).getTime() - new Date(b.soldAt!).getTime()); // Sort by date


      const revenueData: TimeSeriesDataPoint[] = [];
      const profitData: TimeSeriesDataPoint[] = [];
      let currentRevenue = 0;
      let currentProfit = 0;
      let itemIndex = 0;

      dateInterval.forEach((datePoint, index) => {
        // For year view, we want to show data up to the end of each month
        // except for the current month where we show up to the current day
        const thresholdDate = selectedPeriod === 'year' && index === dateInterval.length - 1
          ? now // For current month, use current date
          : endOfDay(selectedPeriod === 'year' ? endOfMonth(datePoint) : datePoint); // For other months, use end of month

        while (
          itemIndex < soldItems.length &&
          new Date(soldItems[itemIndex].soldAt!) <= thresholdDate
          ) {
            const item = soldItems[itemIndex];
            currentRevenue += item.sellingPrice || 0;
            currentProfit += (item.sellingPrice || 0) - (item.purchasePrice || 0);
            itemIndex++;
        }

        revenueData.push({
          x: datePoint,
          y: currentRevenue
        });
        profitData.push({
          x: datePoint,
          y: currentProfit
        });
      });

      // Return an object containing the two data series
      return {
        revenue: revenueData,
        profit: profitData
      };

    } catch (error) {
      console.error('[useStats] Error in calculateMonthlyStats:', error);
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