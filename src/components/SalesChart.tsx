import React, { useCallback, memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import {
  VictoryChart,
  VictoryLine,
  VictoryTheme,
  VictoryAxis,
  VictoryVoronoiContainer,
  VictoryTooltip,
  VictoryLegend,
} from 'victory';

interface SalesChartProps {
  monthlyStats: Array<{
    month: string;
    revenue: number;
    profit: number;
    itemCount: number;
  }>;
  onPeriodChange: (period: 'week' | 'month' | 'year') => void;
  selectedPeriod: 'week' | 'month' | 'year';
}

export const SalesChart: React.FC<SalesChartProps> = memo(({ 
  monthlyStats, 
  onPeriodChange, 
  selectedPeriod 
}) => {
  const renderPeriodButton = useCallback((period: 'week' | 'month' | 'year', label: string) => (
    <Pressable
      style={[
        styles.periodButton,
        selectedPeriod === period && styles.activePeriod
      ]}
      onPress={() => onPeriodChange(period)}
    >
      <Text style={[
        styles.periodText,
        selectedPeriod === period && styles.activePeriodText
      ]}>
        {label}
      </Text>
    </Pressable>
  ), [selectedPeriod, onPeriodChange]);

  const renderChart = useCallback(() => {
    if (!monthlyStats || monthlyStats.length === 0) {
      return (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>
            Aucune donnée disponible pour cette période
          </Text>
        </View>
      );
    }

    return (
      <VictoryChart
        theme={VictoryTheme.material}
        height={300}
        padding={{ top: 50, bottom: 50, left: 50, right: 50 }}
        domainPadding={{ x: 20, y: 20 }}
        containerComponent={
          <VictoryVoronoiContainer
            labels={({ datum }) => 
              `${datum.month}\nCA: ${datum.revenue.toFixed(2)}€\nMarge: ${datum.profit.toFixed(2)}€\n${datum.itemCount} articles`
            }
            labelComponent={
              <VictoryTooltip
                style={{ fontSize: 10 }}
                flyoutStyle={{
                  stroke: '#007AFF',
                  fill: 'white',
                }}
              />
            }
          />
        }
      >
        <VictoryAxis
          tickFormat={(t) => t}
          style={{
            tickLabels: { fontSize: 8, padding: 5, angle: -45 }
          }}
        />
        <VictoryAxis
          dependentAxis
          tickFormat={(t) => `${t}€`}
          style={{
            tickLabels: { fontSize: 8, padding: 5 }
          }}
        />
        
        <VictoryLine
          data={monthlyStats}
          x="month"
          y="revenue"
          style={{
            data: { stroke: '#007AFF', strokeWidth: 2 }
          }}
        />
        
        <VictoryLine
          data={monthlyStats}
          x="month"
          y="profit"
          style={{
            data: { stroke: '#34C759', strokeWidth: 2 }
          }}
        />

        <VictoryLegend
          x={50}
          y={0}
          orientation="horizontal"
          gutter={20}
          style={{ 
            labels: { fontSize: 10 } 
          }}
          data={[
            { name: 'CA', symbol: { fill: '#007AFF' } },
            { name: 'Marge', symbol: { fill: '#34C759' } }
          ]}
        />
      </VictoryChart>
    );
  }, [monthlyStats]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Évolution des ventes</Text>
        <View style={styles.periodSelector}>
          {renderPeriodButton('week', '7J')}
          {renderPeriodButton('month', '1M')}
          {renderPeriodButton('year', '1A')}
        </View>
      </View>
      {renderChart()}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  activePeriod: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  periodText: {
    fontSize: 14,
    color: '#666',
  },
  activePeriodText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  noDataContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  }
});

SalesChart.displayName = 'SalesChart'; 