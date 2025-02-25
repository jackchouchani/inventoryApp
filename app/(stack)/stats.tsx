import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useStats, MonthlyStats } from '../../src/hooks/useStats';
import { StatsChart } from '../../src/components/StatsChart';
import { formatCurrency } from '../../src/utils/formatters';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

const StatsScreen = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [tooltipPos, setTooltipPos] = useState({
    x: 0,
    y: 0,
    visible: false,
    index: 0
  });
  
  const router = useRouter();
  const { stats, monthlyStats, isLoading, error } = useStats(selectedPeriod);

  const handlePeriodChange = useCallback((period: 'week' | 'month' | 'year') => {
    setSelectedPeriod(period);
  }, []);

  const handleDataPointClick = useCallback((index: number, x: number, y: number) => {
    setTooltipPos({
      x,
      y,
      visible: true,
      index
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

  const chartData = {
    labels: monthlyStats.map((stat: MonthlyStats) => stat.month),
    datasets: [
      {
        data: monthlyStats.map((stat: MonthlyStats) => stat.revenue),
        color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
        strokeWidth: 2
      },
      {
        data: monthlyStats.map((stat: MonthlyStats) => stat.profit),
        color: (opacity = 1) => `rgba(52, 199, 89, ${opacity})`,
        strokeWidth: 2
      }
    ],
    legend: ['CA', 'Marge']
  };

  return (
    <ErrorBoundary>
      <View style={styles.container}>
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
            <Text style={styles.sectionTitle}>Résumé Financier</Text>
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
            <Text style={styles.sectionTitle}>Évolution des ventes</Text>
            <View style={styles.periodSelector}>
              <TouchableOpacity
                style={[styles.periodButton, selectedPeriod === 'week' && styles.periodButtonActive]}
                onPress={() => handlePeriodChange('week')}
              >
                <Text style={[styles.periodButtonText, selectedPeriod === 'week' && styles.periodButtonTextActive]}>
                  Semaine
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodButton, selectedPeriod === 'month' && styles.periodButtonActive]}
                onPress={() => handlePeriodChange('month')}
              >
                <Text style={[styles.periodButtonText, selectedPeriod === 'month' && styles.periodButtonTextActive]}>
                  Mois
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodButton, selectedPeriod === 'year' && styles.periodButtonActive]}
                onPress={() => handlePeriodChange('year')}
              >
                <Text style={[styles.periodButtonText, selectedPeriod === 'year' && styles.periodButtonTextActive]}>
                  Année
                </Text>
              </TouchableOpacity>
            </View>
            <StatsChart
              data={chartData}
              onDataPointClick={handleDataPointClick}
            />
            {tooltipPos.visible && (
              <View style={[styles.tooltip, { left: tooltipPos.x - 35, top: tooltipPos.y - 70 }]}>
                <Text style={styles.tooltipText}>
                  CA: {formatCurrency(monthlyStats[tooltipPos.index].revenue)}
                </Text>
                <Text style={styles.tooltipText}>
                  Marge: {formatCurrency(monthlyStats[tooltipPos.index].profit)}
                </Text>
                <Text style={styles.tooltipText}>
                  Ventes: {monthlyStats[tooltipPos.index].itemCount}
                </Text>
              </View>
            )}
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
      </View>
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
  periodSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  periodButtonActive: {
    backgroundColor: '#007AFF',
  },
  periodButtonText: {
    fontSize: 14,
    color: '#666',
  },
  periodButtonTextActive: {
    color: '#fff',
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
});

export default StatsScreen;