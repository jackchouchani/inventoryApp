import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useStats } from '../../src/hooks/useStats';
import { StatsChart } from '../../src/components/StatsChart';
import { formatCurrency } from '../../src/utils/formatters';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import PeriodSelector from '../../src/components/PeriodSelector';

const StatsScreen = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [tooltipPos, setTooltipPos] = useState({
    x: 0,
    y: 0,
    visible: false,
    // Stocker l'index du point cliqué
    dataPointIndex: null as number | null
  });
  
  const router = useRouter();
  const { stats, monthlyStats, isLoading, error } = useStats(selectedPeriod);

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
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error.message}</Text>
      </View>
    );
  }

  // monthlyStats a maintenant le format { revenue: [], profit: [] }
  const chartData = monthlyStats;

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

  // Récupérer les données du point cliqué pour le tooltip
  const clickedRevenuePoint = tooltipPos.dataPointIndex !== null ? monthlyStats.revenue[tooltipPos.dataPointIndex] : null;
  const clickedProfitPoint = tooltipPos.dataPointIndex !== null ? monthlyStats.profit[tooltipPos.dataPointIndex] : null;

  // Récupérer les totaux pour la période (dernier point des données cumulées)
  const totalCA_periode = monthlyStats.revenue.length > 0 ? monthlyStats.revenue[monthlyStats.revenue.length - 1].y : 0;
  const totalMarge_periode = monthlyStats.profit.length > 0 ? monthlyStats.profit[monthlyStats.profit.length - 1].y : 0;

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Statistiques' }} />

        <View style={styles.topBar}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.push('/(tabs)/stock')}
          >
            <MaterialIcons name="arrow-back-ios" size={18} color="#007AFF" />
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
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
                <Text style={styles.financialLabel}>Valeur d'Achat Totale:</Text>
                <Text style={styles.financialValue}>
                  {formatCurrency(stats?.totalPurchaseValue || 0)}
                </Text>
              </View>
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Valeur de Vente Totale:</Text>
                <Text style={styles.financialValue}>
                  {formatCurrency(stats?.totalSellingValue || 0)}
                </Text>
              </View>
              <View style={styles.financialRow}>
                <Text style={[styles.financialLabel, styles.totalProfitLabel]}>Bénéfice Total:</Text>
                <Text style={[styles.financialValue, styles.totalProfitValue]}>
                  {formatCurrency(stats?.totalProfit || 0)}
                </Text>
              </View>
            </View>
          </View>

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
            />
            
            {/* Display tooltip if a data point is clicked */}
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
            <Text style={styles.sectionTitle}>Évolution des ventes ({selectedPeriod === 'week' ? 'Semaine' : selectedPeriod === 'month' ? 'Mois' : 'Année'})</Text>
            {/* Display Totals for selected period */}
            <View style={styles.totalsContainer}>
              {isLoading ? (
                <Text>Chargement des statistiques...</Text>
              ) : (
                monthlyStats.revenue.length > 0 ? (
                  <>
                    <Text style={styles.totalText}>Total CA Période: {formatCurrency(totalCA_periode)}</Text>
                    <Text style={styles.totalText}>Total Marge Période: {formatCurrency(totalMarge_periode)}</Text>
                  </>
                ) : (
                  <Text>Aucune donnée de vente pour cette période.</Text>
                )
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Performance par Catégorie</Text>
            {stats?.categoryStats.map((catStat: typeof stats.categoryStats[0], _index: number) => (
              <View key={catStat.categoryId} style={styles.categoryRow}>
                <View style={styles.categoryNameContainer}>
                  <Text style={styles.categoryName}>{catStat.categoryName}</Text>
                  <Text style={styles.itemCount}>{catStat.itemCount} articles</Text>
                </View>
                <View style={styles.categoryStats}>
                  <View style={styles.categoryStatItem}>
                    <Text style={styles.categoryStatLabel}>Chiffre d'affaires</Text>
                    <Text style={styles.categoryValue}>
                      {formatCurrency(catStat.totalProfit)}
                    </Text>
                  </View>
                  <View style={styles.categoryStatItem}>
                    <Text style={styles.categoryStatLabel}>Marge</Text>
                    <Text style={styles.categoryMargin}>
                      {catStat.averageMargin.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  financialStats: {
    gap: 12,
    marginBottom: 16,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  financialLabel: {
    fontSize: 14,
    color: '#666',
  },
  financialValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  totalProfitLabel: {
    color: '#1a1a1a',
    fontWeight: '600',
  },
  totalProfitValue: {
    color: '#34C759',
    fontSize: 18,
  },
  periodWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 0,
    paddingTop: 16,
    width: '100%',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 8,
    borderRadius: 6,
  },
  tooltipText: {
    color: 'white',
    fontSize: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryNameContainer: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  itemCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  categoryStats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  categoryStatItem: {
    alignItems: 'flex-end',
  },
  categoryStatLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  categoryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  categoryMargin: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34C759',
  },
  tooltipTextDate: {
    color: 'white',
    fontSize: 10,
    marginBottom: 4,
  },
  tooltipContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  tooltipTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1a1a1a',
    textAlign: 'center',
  },
  tooltipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  tooltipLabel: {
    fontSize: 14,
    color: '#666',
  },
  tooltipValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  totalsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  totalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
});

export default StatsScreen;