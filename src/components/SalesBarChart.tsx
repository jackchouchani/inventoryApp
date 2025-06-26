import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import StyleFactory from '../styles/StyleFactory';
import { useAppTheme } from '../contexts/ThemeContext';
import { Icon } from './Icon';
import { formatCurrency } from '../utils/formatters';
import type { TimeSeriesDataPoint } from '../hooks/useStats';

export interface SalesBarChartProps {
  data: {
    daily: TimeSeriesDataPoint[];
    totalRevenue: number;
    totalProfit: number;
    totalSales: number;
  };
  selectedPeriod: 'week' | 'month' | 'year';
  onPeriodChange: (period: 'week' | 'month' | 'year') => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
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
  height?: number;
  isLoading?: boolean;
}

const SalesBarChart: React.FC<SalesBarChartProps> = memo(({
  data,
  selectedPeriod,
  onPeriodChange,
  currentDate,
  onDateChange,
  navigateByDays,
  navigateByWeeks,
  navigateByMonths,
  goToToday,
  canGoNext,
  periodInfo,
  height = 300,
  isLoading = false
}) => {
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'SalesChart');
  const screenWidth = Dimensions.get('window').width;
  
  // État pour le tooltip de détail
  const [selectedDay, setSelectedDay] = React.useState<{
    date: Date;
    revenue: number;
    visible: boolean;
  } | null>(null);

  // Données des onglets de période
  const periodTabs = useMemo(() => [
    {
      id: 'week' as const,
      label: 'Semaine',
      subtitle: '7 jours',
      icon: '📅'
    },
    {
      id: 'month' as const,
      label: 'Mois', 
      subtitle: '30 jours',
      icon: '📊'
    },
    {
      id: 'year' as const,
      label: 'Année',
      subtitle: '12 mois',
      icon: '📈'
    }
  ], []);

  // Navigation functions pour différentes vitesses
  const handleFastPrevious = useCallback(() => {
    switch (selectedPeriod) {
      case 'week':
        navigateByWeeks(-1); // Reculer d'une semaine
        break;
      case 'month':
        navigateByWeeks(-1); // Reculer d'une semaine
        break;
      case 'year':
        navigateByMonths(-3); // Reculer de 3 mois
        break;
    }
  }, [selectedPeriod, navigateByWeeks, navigateByMonths]);

  const handleSlowPrevious = useCallback(() => {
    switch (selectedPeriod) {
      case 'week':
        navigateByDays(-1); // Reculer d'un jour
        break;
      case 'month':
        navigateByDays(-1); // Reculer d'un jour
        break;
      case 'year':
        navigateByMonths(-1); // Reculer d'un mois
        break;
    }
  }, [selectedPeriod, navigateByDays, navigateByMonths]);

  const handleSlowNext = useCallback(() => {
    switch (selectedPeriod) {
      case 'week':
        navigateByDays(1); // Avancer d'un jour
        break;
      case 'month':
        navigateByDays(1); // Avancer d'un jour
        break;
      case 'year':
        navigateByMonths(1); // Avancer d'un mois
        break;
    }
  }, [selectedPeriod, navigateByDays, navigateByMonths]);

  const handleFastNext = useCallback(() => {
    switch (selectedPeriod) {
      case 'week':
        navigateByWeeks(1); // Avancer d'une semaine
        break;
      case 'month':
        navigateByWeeks(1); // Avancer d'une semaine
        break;
      case 'year':
        navigateByMonths(3); // Avancer de 3 mois
        break;
    }
  }, [selectedPeriod, navigateByWeeks, navigateByMonths]);

  // Calculs responsive pour le graphique avec scroll horizontal forcé
  const chartConfig = useMemo(() => {
    const dataLength = data.daily?.length || 0;
    if (dataLength === 0) return { spacing: 20, barWidth: 24, chartWidth: screenWidth - 40 };

    // Configuration fixe pour chaque période (toujours scrollable)
    let barWidth: number;
    let spacing: number;
    let chartWidth: number;

    switch (selectedPeriod) {
      case 'week':
        // 7 jours: Barres confortables avec bon espacement
        barWidth = 40;
        spacing = 25;
        chartWidth = Math.max(screenWidth - 40, dataLength * (barWidth + spacing) + 60);
        break;
        
      case 'month':
        // 30 jours: Barres moyennes avec espacement décent
        barWidth = 18;
        spacing = 12;
        chartWidth = Math.max(screenWidth - 40, dataLength * (barWidth + spacing) + 60);
        break;
        
      case 'year':
        // 12 mois: Barres larges avec bon espacement
        barWidth = 35;
        spacing = 20;
        chartWidth = Math.max(screenWidth - 40, dataLength * (barWidth + spacing) + 60);
        break;
        
      default:
        barWidth = 24;
        spacing = 20;
        chartWidth = screenWidth - 40;
    }

    return { spacing, barWidth, chartWidth };
  }, [data.daily?.length, selectedPeriod, screenWidth]);

  // Prepare chart data avec formatage amélioré selon la période
  const chartData = useMemo(() => {
    if (!data.daily || data.daily.length === 0) return [];

    // Calcul de fréquence des labels
    let labelFrequency: number = 1;
    
    switch (selectedPeriod) {
      case 'week':
        labelFrequency = 1; // Tous les jours
        break;
      case 'month':
        labelFrequency = screenWidth > 768 ? 3 : 5; // Tablette vs mobile
        break;
      case 'year':
        labelFrequency = 1; // Tous les mois
        break;
    }

    return data.daily.map((point, index) => {
      let label = '';
      let shouldShowLabel = false;

      if (selectedPeriod === 'year') {
        // ANNÉE : Afficher tous les mois (Jan, Fév, Mar...)
        label = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(point.x);
        shouldShowLabel = true;
      } else if (selectedPeriod === 'week') {
        // SEMAINE : Afficher tous les jours (L, M, M, J, V, S, D)
        label = new Intl.DateTimeFormat('fr-FR', { weekday: 'narrow' }).format(point.x);
        shouldShowLabel = true;
      } else {
        // MOIS : Afficher sélectivement les jours selon l'écran
        const day = point.x.getDate();
        shouldShowLabel = index % labelFrequency === 0 || index === 0 || index === data.daily.length - 1;
        label = shouldShowLabel ? day.toString() : '';
      }

      return {
        value: point.y,
        label: shouldShowLabel ? label : '',
        labelTextStyle: {
          color: activeTheme.text.secondary,
          fontSize: selectedPeriod === 'week' ? 11 : selectedPeriod === 'month' ? (screenWidth > 768 ? 10 : 9) : 10,
          fontWeight: '500' as const
        },
        frontColor: point.y > 0 ? activeTheme.primary : activeTheme.border,
        spacing: chartConfig.spacing,
      };
    });
  }, [data.daily, selectedPeriod, activeTheme, screenWidth, chartConfig.spacing]);

  const maxValue = useMemo(() => {
    if (chartData.length === 0) return 100;
    const max = Math.max(...chartData.map(d => d.value));
    return max * 1.2; // Add 20% padding
  }, [chartData]);

  // Informations de navigation
  const navigationInfo = useMemo(() => {
    const today = new Date();
    const isAtToday = currentDate.toDateString() === today.toDateString();
    
    switch (selectedPeriod) {
      case 'week':
        return {
          fastPrevLabel: '⏪ 7j',
          slowPrevLabel: '◀ 1j',
          slowNextLabel: '1j ▶',
          fastNextLabel: '7j ⏩',
          todayLabel: 'Actuel',
          periodLabel: `📊 Semaine (7 jours)`
        };
      case 'month':
        return {
          fastPrevLabel: '⏪ 7j',
          slowPrevLabel: '◀ 1j',
          slowNextLabel: '1j ▶',
          fastNextLabel: '7j ⏩',
          todayLabel: 'Actuel',
          periodLabel: `📊 Mois (30 jours)`
        };
      case 'year':
        return {
          fastPrevLabel: '⏪ 3m',
          slowPrevLabel: '◀ 1m',
          slowNextLabel: '1m ▶',
          fastNextLabel: '3m ⏩',
          todayLabel: 'Actuel',
          periodLabel: `📊 Année (12 mois)`
        };
      default:
        return {
          fastPrevLabel: '',
          slowPrevLabel: '',
          slowNextLabel: '',
          fastNextLabel: '',
          todayLabel: '',
          periodLabel: ''
        };
    }
  }, [selectedPeriod, currentDate]);

  if (isLoading) {
    return (
      <View style={styles.salesChartContainer}>
        <View style={styles.salesChartHeader}>
          <Text style={styles.salesChartTitle}>Ventes brutes</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.salesChartContainer}>
      {/* Header avec titre et onglets de période */}
      <View style={styles.salesChartHeader}>
        <View style={styles.salesChartTitleRow}>
          <Text style={styles.salesChartTitle}>Ventes brutes</Text>
        </View>
        
        {/* 🆕 ONGLETS DE PÉRIODE */}
        <View style={styles.periodTabsContainer}>
          {periodTabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.periodTab,
                selectedPeriod === tab.id && styles.periodTabActive
              ]}
              onPress={() => onPeriodChange(tab.id)}
            >
              <Text style={styles.periodTabIcon}>{tab.icon}</Text>
              <Text style={[
                styles.periodTabLabel,
                selectedPeriod === tab.id && styles.periodTabLabelActive
              ]}>
                {tab.label}
              </Text>
              <Text style={[
                styles.periodTabSubtitle,
                selectedPeriod === tab.id && styles.periodTabSubtitleActive
              ]}>
                {tab.subtitle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Montant total et informations */}
        <View style={styles.salesTotalContainer}>
          <Text style={styles.salesTotalAmount}>
            {formatCurrency(data.totalRevenue)}
          </Text>
          <Text style={styles.salesTotalPeriod}>{periodInfo.label}</Text>
          <Text style={styles.salesInfoText}>
            {data.totalSales} vente{data.totalSales > 1 ? 's' : ''}
          </Text>
        </View>

        {/* Contrôles de navigation avancés */}
        <View style={styles.salesNavigationExtended}>
          {/* Groupe de navigation gauche */}
          <View style={styles.navGroup}>
            <TouchableOpacity 
              style={styles.salesNavButtonFast}
              onPress={handleFastPrevious}
            >
              <Text style={styles.salesNavButtonFastText}>
                {navigationInfo.fastPrevLabel}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.salesNavButton}
              onPress={handleSlowPrevious}
            >
              <Text style={styles.salesNavButtonText}>
                {navigationInfo.slowPrevLabel}
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Bouton aujourd'hui */}
          <TouchableOpacity 
            style={[styles.salesTodayButton, !canGoNext && styles.salesTodayButtonDisabled]}
            onPress={goToToday}
            disabled={!canGoNext}
          >
            <Text style={[styles.salesTodayButtonText, !canGoNext && styles.salesTodayButtonTextDisabled]}>
              {navigationInfo.todayLabel}
            </Text>
          </TouchableOpacity>
          
          {/* Groupe de navigation droite */}
          <View style={styles.navGroup}>
            <TouchableOpacity 
              style={[styles.salesNavButton, !canGoNext && styles.salesNavButtonDisabled]}
              onPress={handleSlowNext}
              disabled={!canGoNext}
            >
              <Text style={[styles.salesNavButtonText, !canGoNext && styles.salesNavButtonTextDisabled]}>
                {navigationInfo.slowNextLabel}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.salesNavButtonFast, !canGoNext && styles.salesNavButtonDisabled]}
              onPress={handleFastNext}
              disabled={!canGoNext}
            >
              <Text style={[styles.salesNavButtonFastText, !canGoNext && styles.salesNavButtonTextDisabled]}>
                {navigationInfo.fastNextLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Graphique en barres */}
      <View style={styles.salesChartContent}>
        {chartData.length === 0 ? (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>Aucune vente pour cette période</Text>
          </View>
        ) : (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={{ paddingHorizontal: 10 }}
            style={{ flex: 1 }}
            decelerationRate="fast"
            snapToAlignment="start"
            bounces={true}
          >
            <View style={styles.chartWrapper}>
              <BarChart
                data={chartData}
                height={height - 40}
                width={chartConfig.chartWidth}
                barWidth={chartConfig.barWidth}
                spacing={chartConfig.spacing}
                
                // Styling
                frontColor={activeTheme.primary}
                gradientColor={activeTheme.primaryLight}
                
                // Y-axis
                yAxisThickness={1}
                yAxisColor={activeTheme.border}
                yAxisTextStyle={{ 
                  color: activeTheme.text.secondary, 
                  fontSize: 10 
                }}
                formatYLabel={(value: string) => {
                  const num = Number(value);
                  if (num >= 1000) return `${(num / 1000).toFixed(0)}K€`;
                  return `${num}€`;
                }}
                maxValue={maxValue}
                noOfSections={4}
                
                // X-axis
                xAxisThickness={1}
                xAxisColor={activeTheme.border}
                xAxisLabelTextStyle={{ 
                  color: activeTheme.text.secondary, 
                  fontSize: 10 
                }}
                
                // Grid
                rulesType="solid"
                rulesColor={activeTheme.border}
                
                // Interactions
                onPress={(item: any, index: number) => {
                  const dayData = data.daily[index];
                  if (dayData) {
                    setSelectedDay({
                      date: dayData.x,
                      revenue: dayData.y,
                      visible: true
                    });
                  }
                }}
                
                // Animation
                animationDuration={600}
                
                // Margins
                initialSpacing={15}
                endSpacing={15}
              />
            </View>
          </ScrollView>
        )}
      </View>

      {/* Tooltip de détail du jour sélectionné */}
      {selectedDay && selectedDay.visible && (
        <View style={styles.dayDetailTooltip}>
          <View style={styles.dayDetailContent}>
            <TouchableOpacity 
              style={styles.dayDetailClose}
              onPress={() => setSelectedDay(null)}
            >
              <Text style={styles.dayDetailCloseText}>✕</Text>
            </TouchableOpacity>
            
            <Text style={styles.dayDetailDate}>
              {new Intl.DateTimeFormat('fr-FR', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long',
                year: 'numeric'
              }).format(selectedDay.date)}
            </Text>
            
            <Text style={styles.dayDetailAmount}>
              {formatCurrency(selectedDay.revenue)}
            </Text>
            
            <Text style={styles.dayDetailLabel}>
              Ventes du jour
            </Text>
            
            {selectedDay.revenue === 0 && (
              <Text style={styles.dayDetailNoSales}>
                Aucune vente ce jour-là
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Légende et informations */}
      <View style={styles.salesLegend}>
        <View style={styles.salesLegendItem}>
          <View style={[styles.salesLegendColor, { backgroundColor: activeTheme.primary }]} />
          <Text style={styles.salesLegendText}>
            {selectedPeriod === 'year' ? 'Ventes par mois' : 'Ventes par jour'}
          </Text>
        </View>
        <Text style={styles.salesClickHint}>
          💡 Cliquez sur une barre pour voir les détails
        </Text>
      </View>
    </View>
  );
});

SalesBarChart.displayName = 'SalesBarChart';

export default SalesBarChart; 