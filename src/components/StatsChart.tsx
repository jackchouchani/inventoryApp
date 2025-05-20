import React, { memo, useCallback } from 'react';
import { Dimensions, View, Text, StyleSheet } from 'react-native';
import { VictoryLine, VictoryChart, VictoryTheme, VictoryAxis, VictoryLegend, VictoryVoronoiContainer, VictoryTooltip, VictoryScatter } from 'victory';
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

// Format tooltip content based on period type
const formatTooltipValue = (datum: any, selectedPeriod: 'week' | 'month' | 'year', profitData: Array<{x: Date, y: number, _dataType: string}>) => {
  if (!datum || !datum.x) return '';
  
  const date = new Date(datum.x);
  let dateLabel = '';
  
  switch (selectedPeriod) {
    case 'week':
      dateLabel = format(date, 'EEEE', { locale: fr }); // Full day name
      break;
    case 'month':
      dateLabel = format(date, 'dd MMMM', { locale: fr }); // Day and month
      break;
    case 'year':
      dateLabel = format(date, 'MMMM yyyy', { locale: fr }); // Month and year
      break;
  }
  
  // If this is a revenue data point, find the corresponding profit point
  if (datum._dataType === 'revenue') {
    const profitPoint = profitData.find((p: {x: Date}) => p.x.getTime() === date.getTime());
    const profitValue = profitPoint ? formatCurrency(profitPoint.y) : 'N/A';
    
    return `${dateLabel}\n• CA: ${formatCurrency(datum.y)}\n• BÉNÉFICE: ${profitValue}`;
  }
  
  // For profit data points, return empty string to avoid duplication
  return '';
};

const StatsChart: React.FC<StatsChartProps> = memo(({ 
  data,
  width = Dimensions.get('window').width - 40,
  height = 220,
  onDataPointClick,
  selectedPeriod
}) => {
  // Helper function to create unique data points by date, ensuring x is a Date object
  const createUniqueData = (points: TimeSeriesDataPoint[], dataType: string): Array<{ x: Date; y: number; _dataType: string }> => {
    const uniqueDataMap = new Map<number, { x: Date; y: number; _dataType: string }>();
    for (const point of points) {
      const date = new Date(point.x); // Ensure x is treated as a Date
      const time = date.getTime();
      if (!uniqueDataMap.has(time)) { // Keep the first occurrence for a given timestamp
        uniqueDataMap.set(time, { ...point, x: date, _dataType: dataType });
      }
    }
    // Sort by date after ensuring uniqueness
    return Array.from(uniqueDataMap.values()).sort((a, b) => a.x.getTime() - b.x.getTime());
  };

  // Préparation des données dédupliquées avec type de série identifié
  const deDupRevenueData = createUniqueData(data.revenue, 'revenue');
  const deDupProfitData = createUniqueData(data.profit, 'profit');

  const formatXAxisTick = (tick: any) => {
    if (!(tick instanceof Date)) return ''; // Should be a Date object

    switch (selectedPeriod) {
      case 'week':
        return format(tick, 'EEE', { locale: fr }); // Ex: Lun, Mar
      case 'month':
        return format(tick, 'dd/MM', { locale: fr }); // Ex: 17/05
      case 'year':
        return format(tick, 'MMM yy', { locale: fr }); // Ex: Mai 24, Juin 24
      default:
        return '';
    }
  };

  const getTooltipText = useCallback((datum: any) => {
    // datum here is from deDupRevenueData if triggered by a revenue point
    return formatTooltipValue(datum, selectedPeriod, deDupProfitData);
  }, [selectedPeriod, deDupProfitData]);
  
  // Create a version of getTooltipText that doesn't return null for Victory
  const getVictoryTooltipText = useCallback(({ datum }: { datum: any }) => {
    const text = getTooltipText(datum);
    return text === null ? '' : text;
  }, [getTooltipText]);

  return (
    <View style={styles.chartContainer}>
      <VictoryChart
        width={width}
        height={height}
        theme={VictoryTheme.material}
        domainPadding={{ x: 20, y: 20 }}
        scale={{ x: "time" }}
        containerComponent={
          <VictoryVoronoiContainer
            voronoiDimension="x"
            labels={({ datum }) => {
              // Ne montrer le tooltip que pour les points de revenus
              return datum._dataType === 'revenue' 
                ? getVictoryTooltipText({ datum }) 
                : '';
            }}
            // Désactiver tous les éléments sauf les points de scatter des revenus pour le tooltip
            voronoiBlacklist={['profit-scatter', 'profit-line', 'revenue-line']}
            labelComponent={
              <VictoryTooltip
                style={{ fontSize: 12, fill: 'white', fontWeight: 'bold' }}
                flyoutStyle={{
                  stroke: 'rgba(0,0,0,0.3)',
                  fill: 'rgba(30,30,30,0.95)',
                  padding: 10,
                  pointerEvents: 'none'
                }}
                cornerRadius={5}
                pointerLength={8}
                constrainToVisibleArea
              />
            }
          />
        }
      >
      <VictoryAxis
        tickFormat={formatXAxisTick}
        style={{
          tickLabels: { angle: -45, fontSize: 8 }
        }}
      />
      <VictoryAxis
        dependentAxis
        tickFormat={(t: number) => `${t}€`}
      />
      {/* Revenue Line */}
      <VictoryLine
        name="revenue-line"
        data={deDupRevenueData}
        style={{
          data: { stroke: 'rgba(0, 122, 255, 1)', strokeWidth: 2.5 }
        }}
        events={onDataPointClick ? [{
          target: "data",
          eventHandlers: {
            onPress: () => [{
              target: "data",
              mutation: (props) => {
                const { index, x, y } = props;
                onDataPointClick(index, x, y);
                return null;
              }
            }]
          }
        }] : []}
      />
      
      {/* Revenue data points - only these will trigger tooltips */}
      <VictoryScatter
        name="revenue-scatter" // Changed name for clarity with blacklist
        data={deDupRevenueData}
        size={4}
        style={{
          data: { 
            fill: 'rgba(0, 122, 255, 1)',
            opacity: 0 // Rendre les points invisibles mais toujours cliquables
          }
        }}
      />
      {/* Profit Line */}
      <VictoryLine
        name="profit-line"
        data={deDupProfitData}
        style={{
          data: { stroke: 'rgba(52, 199, 89, 1)', strokeWidth: 2.5 }
        }}
         events={onDataPointClick ? [{
          target: "data",
          eventHandlers: {
            onPress: () => [{
              target: "data",
              mutation: (props) => {
                const { index, x, y } = props;
                onDataPointClick(index, x, y);
                return null;
              }
            }]
          }
        }] : []}
      />
      
      {/* Profit data points - no tooltips */}
      <VictoryScatter
        name="profit-scatter" // Changed name for clarity with blacklist
        data={deDupProfitData}
        size={4}
        style={{
          data: { 
            fill: 'rgba(52, 199, 89, 1)',
            opacity: 0 // Rendre les points invisibles
          }
        }}
      />
      <VictoryLegend
        x={width - 100}
        y={50}
        orientation="vertical"
        data={[
          { name: 'CA', symbol: { fill: 'rgba(0, 122, 255, 1)' } },
          { name: 'Marge', symbol: { fill: 'rgba(52, 199, 89, 1)' } },
        ]}
      />
      </VictoryChart>
      <Text style={styles.interactionHint}>Touchez ou survolez les points pour plus de détails</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  chartContainer: {
    alignItems: 'center',
    width: '100%',
  },
  interactionHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
});

StatsChart.displayName = 'StatsChart';

export { StatsChart };
