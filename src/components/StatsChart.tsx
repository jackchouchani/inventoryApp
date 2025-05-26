import React, { memo, useCallback, useMemo, useState } from 'react';
import { Dimensions, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
}

interface ChartDataPoint {
  value: number;
  date: Date;
  label?: string;
  labelTextStyle?: object;
  dataPointText?: string;
  textShiftY?: number;
  textShiftX?: number;
  showStrip?: boolean;
  stripHeight?: number;
  stripColor?: string;
  stripOpacity?: number;
  dataPointHeight?: number;
  dataPointWidth?: number;
  dataPointColor?: string;
  dataPointRadius?: number;
}

const StatsChart: React.FC<StatsChartProps> = memo(({
  data,
  width = Dimensions.get('window').width - 40,
  height = 220,
  onDataPointClick,
  selectedPeriod
}) => {
  const [selectedDataPoint, setSelectedDataPoint] = useState<{
    index: number;
    value: number;
    date: Date;
    type: 'revenue' | 'profit';
  } | null>(null);
  const [showAnimations, setShowAnimations] = useState(true);

  // Helper function to create unique data points by date
  const createUniqueData = useCallback((points: TimeSeriesDataPoint[]): ChartDataPoint[] => {
    const uniqueDataMap = new Map<number, ChartDataPoint>();

    for (const point of points) {
      const date = new Date(point.x);
      const time = date.getTime();

      if (!uniqueDataMap.has(time)) {
        uniqueDataMap.set(time, {
          value: point.y,
          date: date,
          dataPointRadius: 4,
          dataPointColor: 'transparent',
          showStrip: false,
        });
      }
    }

    return Array.from(uniqueDataMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, []);

  // Préparation des données optimisées
  const { revenueData, profitData, maxValue, minValue } = useMemo(() => {
    const revenue = createUniqueData(data.revenue);
    const profit = createUniqueData(data.profit);

    const allValues = [...revenue.map(d => d.value), ...profit.map(d => d.value)];
    const max = Math.max(...allValues);
    const min = Math.min(...allValues);

    return {
      revenueData: revenue,
      profitData: profit,
      maxValue: max,
      minValue: min
    };
  }, [data.revenue, data.profit, createUniqueData]);

  // Gestionnaire de clic sur les points de données
  const handleDataPointClick = useCallback((index: number) => {
    const revenuePoint = revenueData[index];

    if (revenuePoint) {
      setSelectedDataPoint({
        index,
        value: revenuePoint.value,
        date: revenuePoint.date,
        type: 'revenue'
      });

      onDataPointClick?.(index, revenuePoint.date.getTime(), revenuePoint.value);
    }
  }, [revenueData, onDataPointClick]);

  // Calcul des statistiques pour l'affichage
  const stats = useMemo(() => {
    const totalRevenue = revenueData.reduce((sum, point) => sum + point.value, 0);
    const totalProfit = profitData.reduce((sum, point) => sum + point.value, 0);
    const avgRevenue = totalRevenue / revenueData.length;
    const avgProfit = totalProfit / profitData.length;

    return {
      totalRevenue,
      totalProfit,
      avgRevenue,
      avgProfit,
      profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
    };
  }, [revenueData, profitData]);

  // Préparation des données avec labels formatés pour l'axe X
  const chartDataWithLabels = useMemo(() => {
    return revenueData.map((point) => {
      let label = '';
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

      return {
        ...point,
        label,
        labelTextStyle: { color: '#666', fontSize: 10 }
      };
    });
  }, [revenueData, selectedPeriod]);

  const chartProfitDataWithLabels = useMemo(() => {
    return profitData.map((point) => {
      let label = '';
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

      return {
        ...point,
        label,
        labelTextStyle: { color: '#666', fontSize: 10 }
      };
    });
  }, [profitData, selectedPeriod]);

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

      {/* Graphique principal */}
      <LineChart
        data={chartDataWithLabels}
        data2={chartProfitDataWithLabels}
        height={height}
        width={width}

        // Couleurs et styles
        color1="rgba(0, 122, 255, 1)"
        color2="rgba(52, 199, 89, 1)"
        thickness1={2.5}
        thickness2={2.5}

        // Configuration des axes
        formatYLabel={(value: string) => `${value}€`}
        xAxisThickness={1}
        yAxisThickness={1}
        xAxisColor="rgba(0,0,0,0.1)"
        yAxisColor="rgba(0,0,0,0.1)"
        xAxisLabelTextStyle={{ color: '#666', fontSize: 10 }}

        // Points de données interactifs - CORRIGÉ
        showDataPointOnFocus
        showTextOnFocus
        onPress={handleDataPointClick}
        dataPointsHeight1={6}
        dataPointsWidth1={6}
        dataPointsColor1="rgba(0, 122, 255, 1)"
        dataPointsHeight2={6}
        dataPointsWidth2={6}
        dataPointsColor2="rgba(52, 199, 89, 1)"

        // Tooltips
        showValuesAsDataPointsText={false}

        // Animations
        animateOnDataChange={showAnimations}
        animationDuration={800}

        // Courbes lissées
        curved

        // Grille
        rulesType="solid"
        rulesColor="rgba(0,0,0,0.05)"

        // Espacement et marges
        initialSpacing={20}
        spacing={Math.max(30, (width - 80) / Math.max(revenueData.length - 1, 1))}

        // Configuration des domaines
        maxValue={maxValue * 1.1}

        // Légende sera ajoutée manuellement dans l'interface
      />

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

      {/* Contrôles d'interaction */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[styles.controlButton, { opacity: showAnimations ? 1 : 0.5 }]}
          onPress={() => setShowAnimations(!showAnimations)}
        >
          <Text style={styles.controlButtonText}>
            {showAnimations ? '🎬' : '⏸️'} Animations
          </Text>
        </TouchableOpacity>

        {selectedDataPoint && (
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setSelectedDataPoint(null)}
          >
            <Text style={styles.controlButtonText}>✕ Désélectionner</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Détails du point sélectionné */}
      {selectedDataPoint && (
        <View style={styles.selectedPointInfo}>
          <Text style={styles.selectedPointTitle}>
            {format(selectedDataPoint.date, 'EEEE dd MMMM yyyy', { locale: fr })}
          </Text>
          <Text style={styles.selectedPointValue}>
            CA: {formatCurrency(selectedDataPoint.value)}
          </Text>
          {profitData[selectedDataPoint.index] && (
            <Text style={styles.selectedPointProfit}>
              Marge: {formatCurrency(profitData[selectedDataPoint.index].value)}
            </Text>
          )}
        </View>
      )}

      <Text style={styles.interactionHint}>
        Touchez les points pour plus de détails • Animations {showAnimations ? 'activées' : 'désactivées'}
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
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    gap: 10,
  },
  controlButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 15,
  },
  controlButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  selectedPointInfo: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  selectedPointTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
    textTransform: 'capitalize',
  },
  selectedPointValue: {
    fontSize: 14,
    color: 'rgba(0, 122, 255, 1)',
    fontWeight: '600',
    marginTop: 4,
  },
  selectedPointProfit: {
    fontSize: 14,
    color: 'rgba(52, 199, 89, 1)',
    fontWeight: '600',
    marginTop: 2,
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
});

StatsChart.displayName = 'StatsChart';

export { StatsChart };
