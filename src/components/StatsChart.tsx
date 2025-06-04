import React, { memo, useCallback, useMemo } from 'react';
import { Dimensions, View, Text, StyleSheet, ScrollView } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { TimeSeriesDataPoint } from '../hooks/useStats';
import { formatCurrency } from '../utils/formatters';

interface StatsChartProps {
  data: {
    revenue: TimeSeriesDataPoint[];
    profit: TimeSeriesDataPoint[];
  };
  width?: number;
  height?: number;
  onDataPointClick?: (index: number, x: number, y: number) => void;
  selectedPeriod: 'week' | 'month' | 'year';
  totalRevenueForPeriod?: number;
  totalProfitForPeriod?: number;
}

interface ChartDataPoint {
  value: number;
  date: Date;
  label?: string;
  labelTextStyle?: object;
}

const StatsChart: React.FC<StatsChartProps> = memo(({
  data,
  width = Dimensions.get('window').width - 40,
  height = 220,
  onDataPointClick,
  selectedPeriod,
  totalRevenueForPeriod,
  totalProfitForPeriod
}) => {
  // S'assurer que les valeurs numériques sont valides
  const safeWidth = useMemo(() => {
    const screenWidth = Dimensions.get('window').width;
    return Math.max(200, Math.min(screenWidth - 40, width || screenWidth - 40));
  }, [width]);

  const safeHeight = useMemo(() => {
    return Math.max(200, height || 220);
  }, [height]);

  // Calculer la largeur optimale du graphique selon le nombre de points et la période
  const getOptimalChartWidth = useCallback((dataLength: number, screenWidth: number) => {
    const minSpacing = 40; // Espacement minimum entre les points
    const padding = 80; // Padding pour les labels Y
    
    // Pour la période mensuelle sur mobile, on veut un graphique plus large pour être scrollable
    if (selectedPeriod === 'month' && dataLength > 15) {
      return Math.max(screenWidth, dataLength * minSpacing + padding);
    }
    
    // Pour les autres cas, utiliser la largeur de l'écran
    return screenWidth;
  }, [selectedPeriod]);

  // Helper function to create unique data points by date
  const createUniqueData = useCallback((points: TimeSeriesDataPoint[]): ChartDataPoint[] => {
    if (!points || points.length === 0) {
      return [];
    }

    const uniqueDataMap = new Map<number, ChartDataPoint>();

    for (const point of points) {
      if (!point || typeof point.x === 'undefined' || typeof point.y === 'undefined') {
        continue;
      }

      const date = new Date(point.x);
      const value = Number(point.y);
      
      // Vérifier que la date et la valeur sont valides
      if (isNaN(date.getTime()) || isNaN(value)) {
        continue;
      }

      const time = date.getTime();

      if (!uniqueDataMap.has(time)) {
        uniqueDataMap.set(time, {
          value: value,
          date: date,
        });
      }
    }

    return Array.from(uniqueDataMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, []);

  // Fonction pour grouper les données par semaine si nécessaire (pour la période mensuelle)
  const groupDataByWeek = useCallback((points: ChartDataPoint[]): ChartDataPoint[] => {
    if (!points || points.length === 0) {
      return [];
    }

    if (selectedPeriod !== 'month' || points.length <= 15) {
      return points; // Pas besoin de grouper
    }

    const weeklyData = new Map<string, { values: number[], dates: Date[] }>();
    
    points.forEach(point => {
      if (!point || !point.date || isNaN(point.value)) {
        return;
      }

      const date = new Date(point.date);
      // Obtenir le début de la semaine (lundi)
      const startOfWeek = new Date(date);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);
      
      const weekKey = startOfWeek.toISOString();
      
      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, { values: [], dates: [] });
      }
      
      weeklyData.get(weekKey)!.values.push(point.value);
      weeklyData.get(weekKey)!.dates.push(point.date);
    });

    return Array.from(weeklyData.entries()).map(([weekKey, data]) => {
      const weekDate = new Date(weekKey);
      const avgValue = data.values.reduce((sum, val) => sum + val, 0) / data.values.length;
      
      return {
        value: avgValue,
        date: weekDate,
      };
    }).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [selectedPeriod]);

  // Préparation des données optimisées
  const { revenueData, profitData, maxValue, chartWidth, isGroupedByWeek, hasValidData } = useMemo(() => {
    const rawRevenue = createUniqueData(data.revenue || []);
    const rawProfit = createUniqueData(data.profit || []);
    
    // Grouper par semaine si nécessaire pour améliorer la lisibilité
    const revenue = groupDataByWeek(rawRevenue);
    const profit = groupDataByWeek(rawProfit);
    
    const isGrouped = revenue.length !== rawRevenue.length;

    // S'assurer qu'on a des données valides
    const hasData = revenue.length > 0 || profit.length > 0;
    
    if (!hasData) {
      return {
        revenueData: [],
        profitData: [],
        maxValue: 100, // Valeur par défaut pour éviter NaN
        chartWidth: safeWidth,
        isGroupedByWeek: false,
        hasValidData: false
      };
    }

    const allValues = [...revenue.map(d => d.value), ...profit.map(d => d.value)].filter(v => !isNaN(v));
    const max = allValues.length > 0 ? Math.max(...allValues) : 100;
    
    const optimalWidth = getOptimalChartWidth(revenue.length, safeWidth);

    return {
      revenueData: revenue,
      profitData: profit,
      maxValue: Math.max(max, 1), // S'assurer qu'on a au moins 1 pour éviter les divisions par 0
      chartWidth: optimalWidth,
      isGroupedByWeek: isGrouped,
      hasValidData: true
    };
  }, [data.revenue, data.profit, createUniqueData, groupDataByWeek, getOptimalChartWidth, safeWidth]);

  // Gestionnaire de clic sur les points de données
  const handleDataPointClick = useCallback((item: any, index: number) => {
    console.log('Point de données cliqué:', { item, index });
    
    // Vérifier que l'index est valide
    if (index >= 0 && index < revenueData.length && revenueData[index]) {
      const revenuePoint = revenueData[index];
      onDataPointClick?.(index, revenuePoint.date.getTime(), revenuePoint.value);
    }
  }, [revenueData, onDataPointClick]);

  // 🔧 CORRECTION : Utiliser les vrais totaux de période au lieu de calculer à partir de données cumulatives
  const stats = useMemo(() => {
    if (!hasValidData) {
      return {
        totalRevenue: 0,
        totalProfit: 0,
        avgRevenue: 0,
        avgProfit: 0,
        profitMargin: 0
      };
    }

    // 🆕 Utiliser les totaux corrects transmis en props
    const totalRevenue = totalRevenueForPeriod ?? 0;
    const totalProfit = totalProfitForPeriod ?? 0;
    
    const avgRevenue = totalRevenue / Math.max(revenueData.length, 1);
    const avgProfit = totalProfit / Math.max(profitData.length, 1);

    return {
      totalRevenue: totalRevenue || 0,
      totalProfit: totalProfit || 0,
      avgRevenue: avgRevenue || 0,
      avgProfit: avgProfit || 0,
      profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
    };
  }, [revenueData, profitData, totalRevenueForPeriod, totalProfitForPeriod, hasValidData]);

  // Préparation des données avec labels formatés pour l'axe X
  const chartDataWithLabels = useMemo(() => {
    if (!hasValidData) return [];
    
    return revenueData.map((point) => {
      if (!point || !point.date) return null;
      
      let label = '';
      try {
        switch (selectedPeriod) {
          case 'week':
            label = format(point.date, 'EEE', { locale: fr });
            break;
          case 'month':
            label = format(point.date, 'dd/MM', { locale: fr });
            break;
          case 'year':
            label = format(point.date, 'MMM yy', { locale: fr });
            break;
        }
      } catch (error) {
        label = '';
      }

      return {
        ...point,
        label,
        labelTextStyle: { color: '#666', fontSize: 10 }
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
  }, [revenueData, selectedPeriod, hasValidData]);

  const chartProfitDataWithLabels = useMemo(() => {
    if (!hasValidData) return [];
    
    return profitData.map((point) => {
      if (!point || !point.date) return null;
      
      let label = '';
      try {
        switch (selectedPeriod) {
          case 'week':
            label = format(point.date, 'EEE', { locale: fr });
            break;
          case 'month':
            label = format(point.date, 'dd/MM', { locale: fr });
            break;
          case 'year':
            label = format(point.date, 'MMM yy', { locale: fr });
            break;
        }
      } catch (error) {
        label = '';
      }

      return {
        ...point,
        label,
        labelTextStyle: { color: '#666', fontSize: 10 }
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
  }, [profitData, selectedPeriod, hasValidData]);

  // Déterminer si on a besoin d'un scroll horizontal
  const needsHorizontalScroll = chartWidth > safeWidth;

  // Si pas de données valides, afficher un message
  if (!hasValidData) {
    return (
      <View style={styles.chartContainer}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>CA Total</Text>
            <Text style={[styles.statValue, { color: 'rgba(0, 122, 255, 1)' }]}>
              {formatCurrency(0)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Marge Total</Text>
            <Text style={[styles.statValue, { color: 'rgba(52, 199, 89, 1)' }]}>
              {formatCurrency(0)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Taux Marge</Text>
            <Text style={[styles.statValue, { color: 'rgba(255, 59, 48, 1)' }]}>
              0.0%
            </Text>
          </View>
        </View>
        
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>Aucune donnée disponible pour cette période</Text>
        </View>
        
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: 'rgba(0, 122, 255, 1)' }]} />
            <Text style={styles.legendText}>CA</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: 'rgba(52, 199, 89, 1)' }]} />
            <Text style={styles.legendText}>Marge</Text>
          </View>
        </View>
      </View>
    );
  }

  const chartComponent = useMemo(() => (
    <LineChart
      key={`${selectedPeriod}-${revenueData.length}-${profitData.length}-${maxValue}`}
      data={chartDataWithLabels}
      data2={chartProfitDataWithLabels}
      height={safeHeight}
      width={chartWidth}

      // Couleurs et styles
      color1="rgba(0, 122, 255, 1)"
      color2="rgba(52, 199, 89, 1)"
      thickness1={2.5}
      thickness2={2.5}

      // Configuration des axes
      formatYLabel={(value: string) => {
        const num = Number(value);
        return isNaN(num) ? '0€' : `${num}€`;
      }}
      xAxisThickness={1}
      yAxisThickness={1}
      xAxisColor="rgba(0,0,0,0.1)"
      yAxisColor="rgba(0,0,0,0.1)"
      xAxisLabelTextStyle={{ color: '#666', fontSize: 10 }}
      yAxisTextStyle={{ color: '#666', fontSize: 10 }}
      yAxisLabelWidth={50}

      // Interactions avec points visibles seulement au survol/clic
      focusEnabled={true}
      showDataPointOnFocus={true}
      showTextOnFocus={false}
      showStripOnFocus={false}
      showDataPointLabelOnFocus={false}
      onPress={handleDataPointClick}
      
      // Configuration du pointer avec tooltip
      pointerConfig={{
        pointer1Color: 'rgba(0, 122, 255, 0.8)',
        pointer2Color: 'rgba(52, 199, 89, 0.8)',
        pointerStripUptoDataPoint: true,
        pointerStripColor: 'rgba(0,0,0,0.2)',
        pointerStripWidth: 1,
        activatePointersOnLongPress: false,
        activatePointersDelay: 0,
        hidePointer1: false,
        hidePointer2: false,
        pointerLabelComponent: (items: any) => {
          const item1 = items[0];
          const item2 = items[1];
          
          if (!item1) return null;
          
          return (
            <View style={[styles.customTooltip, { transform: [{ translateX: -140 }] }]}>
              <Text style={styles.tooltipDate}>
                {item1?.date ? format(new Date(item1.date), 'dd MMM', { locale: fr }) : 
                 (revenueData[item1?.index]?.date ? format(revenueData[item1.index].date, 'dd MMM', { locale: fr }) : '')}
              </Text>
              <View style={styles.tooltipRow}>
                <View style={styles.tooltipItem}>
                  <View style={[styles.tooltipColorDot, { backgroundColor: 'rgba(0, 122, 255, 1)' }]} />
                  <Text style={styles.tooltipLabel}>CA: </Text>
                  <Text style={styles.tooltipValue}>{formatCurrency(item1?.value || 0)}</Text>
                </View>
              </View>
              {item2 && (
                <View style={styles.tooltipRow}>
                  <View style={styles.tooltipItem}>
                    <View style={[styles.tooltipColorDot, { backgroundColor: 'rgba(52, 199, 89, 1)' }]} />
                    <Text style={styles.tooltipLabel}>Marge: </Text>
                    <Text style={styles.tooltipValue}>{formatCurrency(item2?.value || 0)}</Text>
                  </View>
                </View>
              )}
            </View>
          );
        },
      }}
      
      // Points de données cachés par défaut, visibles seulement au focus
      hideDataPoints1={true}
      hideDataPoints2={true}
      dataPointsHeight1={8}
      dataPointsWidth1={8}
      dataPointsColor1="rgba(0, 122, 255, 1)"
      dataPointsRadius1={4}
      dataPointsHeight2={8}
      dataPointsWidth2={8}
      dataPointsColor2="rgba(52, 199, 89, 1)"
      dataPointsRadius2={4}
      
      // Affichage des valeurs sur les points (désactivé pour réduire les warnings)
      showValuesAsDataPointsText={false}
      textShiftY={-10}
      textShiftX={0}
      textColor1="rgba(0, 122, 255, 1)"
      textColor2="rgba(52, 199, 89, 1)"
      textFontSize={10}

      // Animations simplifiées
      animateOnDataChange={true}
      animationDuration={600}

      // Courbes lissées
      curved

      // Grille
      rulesType="solid"
      rulesColor="rgba(0,0,0,0.05)"

      // Espacement et marges
      initialSpacing={20}
      spacing={Math.max(30, (chartWidth - 80) / Math.max(revenueData.length - 1, 1))}

      // Configuration des domaines
      maxValue={maxValue * 1.1}
      noOfSections={5}
      stepValue={Math.ceil((maxValue * 1.1) / 5)}

      // S'assurer que les deux courbes sont visibles
      startOpacity1={1}
      startOpacity2={1}
      endOpacity1={1}
      endOpacity2={1}

      // Propriétés spécifiques pour la compatibilité web
      disableScroll={false}
      scrollToEnd={false}
    />
  ), [
    selectedPeriod,
    revenueData,
    profitData,
    chartDataWithLabels,
    chartProfitDataWithLabels,
    safeHeight,
    chartWidth,
    maxValue,
    handleDataPointClick
  ]);

  return (
    <View style={styles.chartContainer}>
      {/* Statistiques rapides */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>CA Total</Text>
          <Text style={[styles.statValue, { color: 'rgba(0, 122, 255, 1)' }]}>
            {formatCurrency(stats.totalRevenue)}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Marge Total</Text>
          <Text style={[styles.statValue, { color: 'rgba(52, 199, 89, 1)' }]}>
            {formatCurrency(stats.totalProfit)}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Taux Marge</Text>
          <Text style={[styles.statValue, { color: stats.profitMargin > 0 ? 'rgba(52, 199, 89, 1)' : 'rgba(255, 59, 48, 1)' }]}>
            {stats.profitMargin.toFixed(1)}%
          </Text>
        </View>
      </View>

      {/* Indication de scroll si nécessaire */}
      {needsHorizontalScroll && (
        <Text style={styles.scrollHint}>
          ← Faites glisser horizontalement pour voir toutes les données →
        </Text>
      )}

      {/* Indication si les données sont groupées par semaine */}
      {isGroupedByWeek && (
        <Text style={styles.groupingHint}>
          📊 Données groupées par semaine pour une meilleure lisibilité
        </Text>
      )}

      {/* Graphique principal avec scroll horizontal si nécessaire */}
      {needsHorizontalScroll ? (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={true}
          style={styles.chartScrollContainer}
          contentContainerStyle={styles.chartScrollContent}
        >
          {chartComponent}
        </ScrollView>
      ) : (
        chartComponent
      )}

      {/* Légende manuelle */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: 'rgba(0, 122, 255, 1)' }]} />
          <Text style={styles.legendText}>CA</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: 'rgba(52, 199, 89, 1)' }]} />
          <Text style={styles.legendText}>Marge</Text>
        </View>
      </View>

      <Text style={styles.interactionHint}>
        Touchez ou survolez les points pour voir les détails
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  chartContainer: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
  },
  scrollHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  groupingHint: {
    fontSize: 11,
    color: '#007AFF',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingVertical: 6,
    borderRadius: 12,
    marginHorizontal: 20,
  },
  chartScrollContainer: {
    width: '100%',
  },
  chartScrollContent: {
    paddingHorizontal: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  noDataContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 8,
    marginVertical: 10,
    width: '90%',
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  interactionHint: {
    fontSize: 11,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  customTooltip: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    borderRadius: 8,
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tooltipDate: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
    textTransform: 'capitalize',
  },
  tooltipRow: {
    marginVertical: 2,
  },
  tooltipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  tooltipColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  tooltipLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '500',
  },
  tooltipValue: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
});

StatsChart.displayName = 'StatsChart';

export { StatsChart };
