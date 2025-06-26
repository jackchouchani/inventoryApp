import { useState, useCallback, useMemo } from 'react';
import { 
  startOfDay, 
  endOfDay, 
  subDays, 
  subYears, 
  eachDayOfInterval, 
  eachMonthOfInterval,
  isSameDay,
  isSameMonth,
  format
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useContainerPageData } from './useOptimizedSelectors';
import type { Item } from '../types/item';
import type { TimeSeriesDataPoint } from './useStats';

export interface SalesData {
  daily: TimeSeriesDataPoint[];
  totalRevenue: number;
  totalProfit: number;
  totalSales: number;
}

export interface UseSalesDataReturn {
  data: SalesData;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  navigateByDays: (days: number) => void;
  navigateByWeeks: (weeks: number) => void;
  navigateByMonths: (months: number) => void;
  goToToday: () => void;
  canGoNext: boolean;
  periodInfo: {
    startDate: Date;
    endDate: Date;
    label: string;
  };
  isLoading: boolean;
  error: string | null;
}

export const useSalesData = (selectedPeriod: 'week' | 'month' | 'year'): UseSalesDataReturn => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const { items = [], isLoading, error } = useContainerPageData();

  const calculateSalesData = useCallback((items: Item[], period: 'week' | 'month' | 'year', endDate: Date): SalesData => {
    try {
      let startDate: Date;
      let dateInterval: Date[] = [];

      // Calculer la période glissante
      switch (period) {
        case 'week':
          startDate = subDays(endDate, 6); // 7 derniers jours
          dateInterval = eachDayOfInterval({ start: startDate, end: endDate });
          break;
        case 'month':
          startDate = subDays(endDate, 29); // 30 derniers jours
          dateInterval = eachDayOfInterval({ start: startDate, end: endDate });
          break;
        case 'year':
          startDate = subYears(endDate, 1); // 12 derniers mois
          dateInterval = eachMonthOfInterval({ start: startDate, end: endDate });
          break;
        default:
          startDate = subDays(endDate, 29);
          dateInterval = eachDayOfInterval({ start: startDate, end: endDate });
      }

      // Filtrer les articles vendus dans la période
      const soldItemsInPeriod = items.filter(item => {
        if (item.status !== 'sold' || !item.soldAt) return false;
        
        try {
          const soldDate = new Date(item.soldAt);
          return soldDate >= startOfDay(startDate) && soldDate <= endOfDay(endDate);
        } catch (error) {
          console.error(`[useSalesData] Error parsing date for item ${item.name}: ${item.soldAt}`, error);
          return false;
        }
      });

      // Calculer les données journalières/mensuelles
      const dailyData: TimeSeriesDataPoint[] = [];
      let totalRevenue = 0;
      let totalProfit = 0;
      let totalSales = 0;

      dateInterval.forEach(datePoint => {
        let periodRevenue = 0;
        let periodProfit = 0;
        let periodSalesCount = 0;

        // Trouver les ventes pour cette période
        const salesForPeriod = soldItemsInPeriod.filter(item => {
          const itemSoldDate = new Date(item.soldAt!);
          
          if (period === 'year') {
            // Pour l'année, comparer par mois
            return isSameMonth(itemSoldDate, datePoint);
          } else {
            // Pour semaine/mois, comparer par jour
            return isSameDay(itemSoldDate, datePoint);
          }
        });

        salesForPeriod.forEach(item => {
          const revenue = item.sellingPrice || 0;
          const profit = revenue - (item.purchasePrice || 0);
          
          periodRevenue += revenue;
          periodProfit += profit;
          periodSalesCount++;
        });

        dailyData.push({
          x: datePoint,
          y: periodRevenue
        });

        totalRevenue += periodRevenue;
        totalProfit += periodProfit;
        totalSales += periodSalesCount;
      });

      return {
        daily: dailyData,
        totalRevenue,
        totalProfit,
        totalSales
      };

    } catch (error) {
      console.error('[useSalesData] Error calculating sales data:', error);
      return {
        daily: [],
        totalRevenue: 0,
        totalProfit: 0,
        totalSales: 0
      };
    }
  }, []);

  const data = useMemo(() => {
    return calculateSalesData(items, selectedPeriod, currentDate);
  }, [items, selectedPeriod, currentDate, calculateSalesData]);

  const handleDateChange = useCallback((newDate: Date) => {
    // S'assurer qu'on ne dépasse pas la date d'aujourd'hui
    const today = new Date();
    if (newDate > today) {
      setCurrentDate(today);
    } else {
      setCurrentDate(newDate);
    }
  }, []);

  // Navigation par jours
  const navigateByDays = useCallback((days: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    handleDateChange(newDate);
  }, [currentDate, handleDateChange]);

  // Navigation par semaines
  const navigateByWeeks = useCallback((weeks: number) => {
    navigateByDays(weeks * 7);
  }, [navigateByDays]);

  // Navigation par mois
  const navigateByMonths = useCallback((months: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + months);
    handleDateChange(newDate);
  }, [currentDate, handleDateChange]);

  // Aller à aujourd'hui
  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // Vérifier si on peut aller vers le futur
  const canGoNext = useMemo(() => {
    const today = new Date();
    return currentDate < today;
  }, [currentDate]);

  // Informations sur la période
  const periodInfo = useMemo(() => {
    let startDate: Date;
    let endDate: Date = currentDate;
    let label: string;

    switch (selectedPeriod) {
      case 'week':
        startDate = subDays(currentDate, 6);
        label = `${format(startDate, 'dd MMM', { locale: fr })} - ${format(currentDate, 'dd MMM yyyy', { locale: fr })}`;
        break;
      case 'month':
        startDate = subDays(currentDate, 29);
        label = `${format(startDate, 'dd MMM', { locale: fr })} - ${format(currentDate, 'dd MMM yyyy', { locale: fr })}`;
        break;
      case 'year':
        startDate = subYears(currentDate, 1);
        label = `${format(startDate, 'MMM yyyy', { locale: fr })} - ${format(currentDate, 'MMM yyyy', { locale: fr })}`;
        break;
      default:
        startDate = subDays(currentDate, 29);
        label = '';
    }

    return {
      startDate,
      endDate,
      label
    };
  }, [selectedPeriod, currentDate]);

  return {
    data,
    currentDate,
    setCurrentDate: handleDateChange,
    navigateByDays,
    navigateByWeeks,
    navigateByMonths,
    goToToday,
    canGoNext,
    periodInfo,
    isLoading,
    error: error || null
  };
}; 