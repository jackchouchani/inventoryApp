import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ✅ STYLEFACTORY selon stylefactory-optimization.mdc
import StyleFactory from '../../src/styles/StyleFactory';

import { CommonHeader, SalesBarChart } from '../../src/components';
import { useStats } from '../../src/hooks/useStats';
import { useDashboardData } from '../../src/hooks/useOptimizedSelectors';

import { StatsChart } from '../../src/components/StatsChart';
import CategoryPieChart from '../../src/components/CategoryPieChart';
import ContainerBarChart from '../../src/components/ContainerBarChart';
import { formatCurrency } from '../../src/utils/formatters';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import PeriodSelector from '../../src/components/PeriodSelector';
import { useAppTheme } from '../../src/contexts/ThemeContext';
import { useSalesData } from '../../src/hooks/useSalesData';

const StatsScreen = () => {
  const { activeTheme } = useAppTheme();
  const router = useRouter();
  
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [salesPeriod, setSalesPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [tooltipPos, setTooltipPos] = useState({
    x: 0,
    y: 0,
    visible: false,
    dataPointIndex: null as number | null
  });
  
  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'Stats');
  
  const { stats, periodStats, isLoading, error } = useStats(selectedPeriod);


  
  // Hook pour les données de ventes avec navigation temporelle
  const salesData = useSalesData(salesPeriod);

  // Hook pour les données de containers
  const { itemsByContainer } = useDashboardData();

  // Reset tooltip function
  const resetTooltip = useCallback(() => {
    if (tooltipPos.visible) {
      setTooltipPos({ x: 0, y: 0, visible: false, dataPointIndex: null });
    }
  }, [tooltipPos]);
  
  const handlePeriodChange = useCallback((period: 'week' | 'month' | 'year') => {
    setSelectedPeriod(period);
    resetTooltip(); // Reset tooltip when period changes
  }, [resetTooltip]);

  // 🆕 Handler pour le changement de période du graphique de ventes
  const handleSalesPeriodChange = useCallback((period: 'week' | 'month' | 'year') => {
    setSalesPeriod(period);
  }, []);

  // handleDataPointClick reçoit maintenant l'index du point cliqué
  const handleDataPointClick = useCallback((index: number, x: number, y: number) => {
    console.log('Data point clicked:', { index, x, y });
    setTooltipPos({
      x,
      y,
      visible: true,
      dataPointIndex: index,
    });
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const chartData = {
    revenue: periodStats.revenue,
    profit: periodStats.profit
  };

  const formatTooltipDate = (date: Date | null) => {
    if (!date) return '';
    switch (selectedPeriod) {
      case 'week':
        return format(date, 'EEEE', { locale: fr }); // Lundi, Mardi
      case 'month':
        return format(date, 'dd MMMM', { locale: fr }); // 17 mai
      case 'year':
        return format(date, 'MMMM yyyy', { locale: fr }); // mai 2024
      default:
        return '';
    }
  };

  const clickedRevenuePoint = tooltipPos.dataPointIndex !== null ? periodStats.revenue[tooltipPos.dataPointIndex] : null;
  const clickedProfitPoint = tooltipPos.dataPointIndex !== null ? periodStats.profit[tooltipPos.dataPointIndex] : null;

  const totalCA_periode = periodStats.totalRevenueForPeriod;
  const totalMarge_periode = periodStats.totalProfitForPeriod;
  
  const tauxMarge_periode = totalCA_periode > 0 ? (totalMarge_periode / totalCA_periode) * 100 : 0;

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Statistiques' }} />

        <CommonHeader 
          title="Statistiques"
          onBackPress={() => router.back()}
        />

        <ScrollView style={styles.content}>
          {/* 🆕 GRAPHIQUE VENTES - Tout en haut */}
          <SalesBarChart
            data={salesData.data}
            selectedPeriod={salesPeriod}
            currentDate={salesData.currentDate}
            onDateChange={salesData.setCurrentDate}
            navigateByDays={salesData.navigateByDays}
            navigateByWeeks={salesData.navigateByWeeks}
            navigateByMonths={salesData.navigateByMonths}
            goToToday={salesData.goToToday}
            canGoNext={salesData.canGoNext}
            periodInfo={salesData.periodInfo}
            height={350}
            isLoading={salesData.isLoading}
            onPeriodChange={handleSalesPeriodChange}
          />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vue d'ensemble</Text>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats?.totalItems || 0}</Text>
                <Text style={styles.statLabel}>Total Articles</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats?.availableItems || 0}</Text>
                <Text style={styles.statLabel}>Disponibles</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats?.soldItems || 0}</Text>
                <Text style={styles.statLabel}>Vendus</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Résumé Financier Global</Text>
            <View style={styles.financialStats}>
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Valeur d'Achat Totale (tous articles):</Text>
                <Text style={styles.financialValue}>
                  {formatCurrency(stats?.totalPurchaseValue || 0)}
                </Text>
              </View>
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Valeur de Vente Totale (tous articles):</Text>
                <Text style={styles.financialValue}>
                  {formatCurrency(stats?.totalSellingValue || 0)}
                </Text>
              </View>
              <View style={styles.financialRow}>
                <Text style={[styles.financialLabel, styles.totalProfitLabel]}>Bénéfice Potentiel Total:</Text>
                <Text style={[styles.financialValue, styles.totalProfitValue]}>
                  {formatCurrency(stats?.totalProfit || 0)}
                </Text>
              </View>
            </View>
          </View>

          {/* 🆕 NOUVELLES SECTIONS - Articles en Stock et Vendus */}
          {stats && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Articles en Stock (Disponibles)</Text>
                <View style={styles.stockStatsContainer}>
                  <View style={styles.stockStatRow}>
                    <View style={styles.stockStatItem}>
                      <Text style={styles.stockStatLabel}>Quantité</Text>
                      <Text style={styles.stockStatValue}>{stats.availableItemsStats.count}</Text>
                    </View>
                    <View style={styles.stockStatItem}>
                      <Text style={styles.stockStatLabel}>Prix d'Achat Total</Text>
                      <Text style={styles.stockStatValue}>
                        {formatCurrency(stats.availableItemsStats.totalPurchaseValue)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.stockStatRow}>
                    <View style={styles.stockStatItem}>
                      <Text style={styles.stockStatLabel}>Prix de Vente Total</Text>
                      <Text style={styles.stockStatValue}>
                        {formatCurrency(stats.availableItemsStats.totalSellingValue)}
                      </Text>
                    </View>
                    <View style={styles.stockStatItem}>
                      <Text style={styles.stockStatLabel}>Bénéfice Potentiel</Text>
                      <Text style={[styles.stockStatValue, styles.potentialProfitValue]}>
                        {formatCurrency(stats.availableItemsStats.potentialProfit)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Articles Vendus</Text>
                <View style={styles.stockStatsContainer}>
                  <View style={styles.stockStatRow}>
                    <View style={styles.stockStatItem}>
                      <Text style={styles.stockStatLabel}>Quantité</Text>
                      <Text style={styles.stockStatValue}>{stats.soldItemsStats.count}</Text>
                    </View>
                    <View style={styles.stockStatItem}>
                      <Text style={styles.stockStatLabel}>Prix d'Achat Total</Text>
                      <Text style={styles.stockStatValue}>
                        {formatCurrency(stats.soldItemsStats.totalPurchaseValue)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.stockStatRow}>
                    <View style={styles.stockStatItem}>
                      <Text style={styles.stockStatLabel}>Prix de Vente Total</Text>
                      <Text style={styles.stockStatValue}>
                        {formatCurrency(stats.soldItemsStats.totalSellingValue)}
                      </Text>
                    </View>
                    <View style={styles.stockStatItem}>
                      <Text style={styles.stockStatLabel}>Bénéfice Réalisé</Text>
                      <Text style={[styles.stockStatValue, styles.actualProfitValue]}>
                        {formatCurrency(stats.soldItemsStats.actualProfit)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </>
          )}

          <View style={styles.section}>
            <View style={styles.periodWrapper}>
              <PeriodSelector
                selectedPeriod={selectedPeriod}
                onSelectPeriod={handlePeriodChange}
              />
            </View>
            <StatsChart
              data={chartData}
              selectedPeriod={selectedPeriod}
              onDataPointClick={handleDataPointClick}
              totalRevenueForPeriod={totalCA_periode}
              totalProfitForPeriod={totalMarge_periode}
            />
            
            {tooltipPos.visible && tooltipPos.dataPointIndex !== null && (
              <View style={styles.tooltipContainer}>
                <Text style={styles.tooltipTitle}>
                  {clickedRevenuePoint ? formatTooltipDate(clickedRevenuePoint.x) : ''}
                </Text>
                <View style={styles.tooltipRow}>
                  <Text style={styles.tooltipLabel}>Chiffre d'affaires:</Text>
                  <Text style={[styles.tooltipValue, {color: 'rgba(0, 122, 255, 1)'}]}>
                    {clickedRevenuePoint ? formatCurrency(clickedRevenuePoint.y) : ''}
                  </Text>
                </View>
                <View style={styles.tooltipRow}>
                  <Text style={styles.tooltipLabel}>Bénéfice:</Text>
                  <Text style={[styles.tooltipValue, {color: 'rgba(52, 199, 89, 1)'}]}>
                    {clickedProfitPoint ? formatCurrency(clickedProfitPoint.y) : ''}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Statistiques par Catégories</Text>

            {stats?.categoryStats && stats.categoryStats.length > 0 ? (
              <CategoryPieChart data={stats.categoryStats} height={220} />
            ) : (
              <Text style={styles.noDataText}>Aucune donnée de catégorie disponible</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Statistiques par Containers</Text>
            {itemsByContainer && itemsByContainer.length > 0 ? (
              <ContainerBarChart data={itemsByContainer} height={280} />
            ) : (
              <Text style={styles.noDataText}>Aucune donnée de container disponible</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Articles Performance</Text>
            
            {stats?.bestSellingItem && (
              <View style={styles.performanceCard}>
                <View style={styles.performanceHeader}>
                  <Text style={styles.performanceTitle}>🏆 Article le plus rentable</Text>
                </View>
                <View style={styles.performanceContent}>
                  <Text style={styles.performanceName}>{stats.bestSellingItem.name}</Text>
                  <View style={styles.performanceStats}>
                    <Text style={styles.performanceProfit}>
                      Bénéfice: {formatCurrency(stats.bestSellingItem.profit)}
                    </Text>
                    <Text style={styles.performanceMargin}>
                      Marge: {stats.bestSellingItem.margin.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {stats?.worstSellingItem && (
              <View style={styles.performanceCard}>
                <View style={styles.performanceHeader}>
                  <Text style={styles.performanceTitle}>📉 Article le moins rentable</Text>
                </View>
                <View style={styles.performanceContent}>
                  <Text style={styles.performanceName}>{stats.worstSellingItem.name}</Text>
                  <View style={styles.performanceStats}>
                    <Text style={styles.performanceProfit}>
                      Bénéfice: {formatCurrency(stats.worstSellingItem.profit)}
                    </Text>
                    <Text style={styles.performanceMargin}>
                      Marge: {stats.worstSellingItem.margin.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {stats && (
              <View style={styles.performanceCard}>
                <View style={styles.performanceHeader}>
                  <Text style={styles.performanceTitle}>📊 Moyennes Globales</Text>
                </View>
                <View style={styles.performanceContent}>
                  <View style={styles.averageRow}>
                    <Text style={styles.averageLabel}>Bénéfice moyen par article:</Text>
                    <Text style={styles.averageValue}>{formatCurrency(stats.averageProfit)}</Text>
                  </View>
                  <View style={styles.averageRow}>
                    <Text style={styles.averageLabel}>Marge moyenne:</Text>
                    <Text style={styles.averageValue}>{stats.averageMarginPercentage.toFixed(1)}%</Text>
                  </View>
                  <View style={styles.averageRow}>
                    <Text style={styles.averageLabel}>Taux de vente:</Text>
                    <Text style={styles.averageValue}>
                      {stats.totalItems > 0 ? ((stats.soldItems / stats.totalItems) * 100).toFixed(1) : 0}%
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>



        </ScrollView>
      </View>
    </ErrorBoundary>
  );
};

export default StatsScreen;