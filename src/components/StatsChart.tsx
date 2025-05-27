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
    profitValue?: number;
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
          showStrip: true,
          stripHeight: height,
          stripColor: 'rgba(0,0,0,0.1)',
          stripOpacity: 0.3,
        });
      }
    }

    return Array.from(uniqueDataMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [height]);

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
  const handleDataPointClick = useCallback((item: any, index: number) => {
    console.log('Point de données cliqué:', { item, index });
    
    // Vérifier que l'index est valide
    if (index >= 0 && index < revenueData.length) {
      const revenuePoint = revenueData[index];
      const profitPoint = profitData[index];

      setSelectedDataPoint({
        index,
        value: revenuePoint.value,
        date: revenuePoint.date,
        type: 'revenue',
        profitValue: profitPoint?.value || 0
      });

      onDataPointClick?.(index, revenuePoint.date.getTime(), revenuePoint.value);
    }
  }, [revenueData, profitData, onDataPointClick]);

  // Calcul des statistiques pour l'affichage
  const stats = useMemo(() => {
    // Pour des données mensuelles, prendre la dernière valeur (cumul du mois)
    // ou la somme selon le contexte
    let totalRevenue, totalProfit;
    
    if (selectedPeriod === 'month') {
      // Pour un mois, prendre la dernière valeur qui représente le cumul
      totalRevenue = revenueData.length > 0 ? revenueData[revenueData.length - 1].value : 0;
      totalProfit = profitData.length > 0 ? profitData[profitData.length - 1].value : 0;
    } else {
      // Pour semaine/année, sommer toutes les valeurs
      totalRevenue = revenueData.reduce((sum, point) => sum + point.value, 0);
      totalProfit = profitData.reduce((sum, point) => sum + point.value, 0);
    }
    
    const avgRevenue = totalRevenue / Math.max(revenueData.length, 1);
    const avgProfit = totalProfit / Math.max(profitData.length, 1);

    return {
      totalRevenue,
      totalProfit,
      avgRevenue,
      avgProfit,
      profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
    };
  }, [revenueData, profitData, selectedPeriod]);

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
        yAxisTextStyle={{ color: '#666', fontSize: 10 }}
        yAxisLabelWidth={50}

        // Activation des interactions avancées
        focusEnabled={true}
        showDataPointOnFocus={true}
        showTextOnFocus={true}
        showStripOnFocus={true}
        showDataPointLabelOnFocus={true}
        onPress={handleDataPointClick}
        
        // Configuration du pointer pour les tooltips
        pointerConfig={{
          pointer1Color: 'rgba(0, 122, 255, 0.8)',
          pointer2Color: 'rgba(52, 199, 89, 0.8)',
          pointerStripUptoDataPoint: true,
          pointerStripColor: 'rgba(0,0,0,0.2)',
          pointerStripWidth: 1,
          strokeDashArray: [2, 5],
          activatePointersOnLongPress: false,
          activatePointersDelay: 0,
          hidePointer1: false,
          hidePointer2: false,
          pointerLabelComponent: (items: any) => {
            const item1 = items[0];
            const item2 = items[1];
            return (
              <View style={styles.customTooltip}>
                <Text style={styles.tooltipDate}>
                  {format(new Date(item1?.date || revenueData[item1?.index]?.date), 'dd MMM', { locale: fr })}
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
        
        // Points de données visibles et interactifs
        hideDataPoints1={false}
        hideDataPoints2={false}
        dataPointsHeight1={10}
        dataPointsWidth1={10}
        dataPointsColor1="rgba(0, 122, 255, 1)"
        dataPointsRadius1={5}
        dataPointsHeight2={10}
        dataPointsWidth2={10}
        dataPointsColor2="rgba(52, 199, 89, 1)"
        dataPointsRadius2={5}
        
        // Affichage des valeurs sur les points
        showValuesAsDataPointsText={false}
        textShiftY={-10}
        textShiftX={0}
        textColor1="rgba(0, 122, 255, 1)"
        textColor2="rgba(52, 199, 89, 1)"
        textFontSize={10}

        // Animations (contrôlées par l'utilisateur)
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
        noOfSections={5}
        stepValue={Math.ceil((maxValue * 1.1) / 5)}

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

      {/* Navigation des points de données */}
      <View style={styles.navigationRow}>
        <TouchableOpacity
          style={[styles.navButton, { opacity: selectedDataPoint && selectedDataPoint.index > 0 ? 1 : 0.3 }]}
          onPress={() => {
            if (selectedDataPoint && selectedDataPoint.index > 0) {
              const newIndex = selectedDataPoint.index - 1;
              const revenuePoint = revenueData[newIndex];
              const profitPoint = profitData[newIndex];
              setSelectedDataPoint({
                index: newIndex,
                value: revenuePoint.value,
                date: revenuePoint.date,
                type: 'revenue',
                profitValue: profitPoint?.value || 0
              });
            }
          }}
          disabled={!selectedDataPoint || selectedDataPoint.index <= 0}
        >
          <Text style={styles.navButtonText}>← Précédent</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.exploreButton}
          onPress={() => {
            if (!selectedDataPoint && revenueData.length > 0) {
              // Sélectionner le point avec la meilleure performance (plus haut CA)
              const maxRevenueIndex = revenueData.reduce((maxIndex, current, index) => 
                current.value > revenueData[maxIndex].value ? index : maxIndex, 0
              );
              const revenuePoint = revenueData[maxRevenueIndex];
              const profitPoint = profitData[maxRevenueIndex];
              setSelectedDataPoint({
                index: maxRevenueIndex,
                value: revenuePoint.value,
                date: revenuePoint.date,
                type: 'revenue',
                profitValue: profitPoint?.value || 0
              });
            } else if (selectedDataPoint) {
              // Basculer vers le point avec la meilleure marge
              const maxProfitIndex = profitData.reduce((maxIndex, current, index) => 
                current.value > profitData[maxIndex].value ? index : maxIndex, 0
              );
              const revenuePoint = revenueData[maxProfitIndex];
              const profitPoint = profitData[maxProfitIndex];
              setSelectedDataPoint({
                index: maxProfitIndex,
                value: revenuePoint.value,
                date: revenuePoint.date,
                type: 'revenue',
                profitValue: profitPoint?.value || 0
              });
            }
          }}
        >
          <Text style={styles.exploreButtonText}>
            {selectedDataPoint ? '🎯 Meilleure marge' : '📈 Point culminant'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, { opacity: selectedDataPoint && selectedDataPoint.index < revenueData.length - 1 ? 1 : 0.3 }]}
          onPress={() => {
            if (selectedDataPoint && selectedDataPoint.index < revenueData.length - 1) {
              const newIndex = selectedDataPoint.index + 1;
              const revenuePoint = revenueData[newIndex];
              const profitPoint = profitData[newIndex];
              setSelectedDataPoint({
                index: newIndex,
                value: revenuePoint.value,
                date: revenuePoint.date,
                type: 'revenue',
                profitValue: profitPoint?.value || 0
              });
            }
          }}
          disabled={!selectedDataPoint || selectedDataPoint.index >= revenueData.length - 1}
        >
          <Text style={styles.navButtonText}>Suivant →</Text>
        </TouchableOpacity>
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
          {selectedDataPoint.profitValue !== undefined && (
            <Text style={styles.selectedPointProfit}>
              Marge: {formatCurrency(selectedDataPoint.profitValue)}
            </Text>
          )}
        </View>
      )}

      <Text style={styles.interactionHint}>
        Touchez ou survolez les points pour voir les détails • Animations {showAnimations ? 'activées' : 'désactivées'}
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
  navigationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 10,
    gap: 10,
  },
  navButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.2)',
    minWidth: 90,
  },
  navButtonText: {
    fontSize: 12,
    color: 'rgba(0, 122, 255, 1)',
    fontWeight: '500',
    textAlign: 'center',
  },
  exploreButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.2)',
    flex: 1,
    marginHorizontal: 5,
  },
  exploreButtonText: {
    fontSize: 13,
    color: 'rgba(52, 199, 89, 1)',
    fontWeight: '600',
    textAlign: 'center',
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
