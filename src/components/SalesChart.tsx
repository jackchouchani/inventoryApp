import React, { useCallback, memo, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withSpring,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import {
  VictoryChart,
  VictoryLine,
  VictoryTheme,
  VictoryAxis,
  VictoryVoronoiContainer,
  VictoryTooltip,
  VictoryLegend,
  VictoryZoomContainerProps,
} from 'victory';
import { useTheme } from '../hooks/useTheme';
import { formatCurrency } from '../utils/formatters';
import * as Sentry from '@sentry/react-native';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import { ErrorBoundary } from './ErrorBoundary';
import type { FallbackProps } from 'react-error-boundary';

export type Period = 'week' | 'month' | 'year';

export interface SalesData {
  month: string;
  revenue: number;
  profit: number;
  itemCount: number;
}

interface ChartDatum extends SalesData {
  x: string;
  y: number;
}

interface SalesChartProps {
  onPeriodChange: (period: Period) => void;
  selectedPeriod: Period;
  onError?: (error: Error) => void;
}

const PERIOD_LABELS: Record<Period, string> = {
  week: '7J',
  month: '1M',
  year: '1A'
};

const fetchSalesData = async (period: Period): Promise<SalesData[]> => {
  try {
    const { data, error } = await supabase
      .from('sales_stats')
      .select('*')
      .eq('period', period);

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        component: 'SalesChart',
        operation: 'fetchSalesData'
      }
    });
    throw error;
  }
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => (
  <View style={styles.noDataContainer}>
    <Text style={[styles.noDataText, styles.errorText]}>
      Une erreur est survenue
    </Text>
    <Text style={styles.errorDetail}>{error.message}</Text>
    <Pressable 
      onPress={resetErrorBoundary}
      style={styles.retryButton}
    >
      <Text style={styles.retryText}>Réessayer</Text>
    </Pressable>
  </View>
);

export const SalesChart: React.FC<SalesChartProps> = memo(({ 
  onPeriodChange, 
  selectedPeriod,
  onError
}) => {
  const theme = useTheme();
  const scale = useSharedValue(1);
  
  const queryOptions: UseQueryOptions<SalesData[], Error, SalesData[], readonly [string, Period]> = {
    queryKey: ['sales', selectedPeriod],
    queryFn: () => fetchSalesData(selectedPeriod),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 60, // 1 heure
    retry: 3
  };

  const { data: monthlyStats, isLoading, error } = useQuery(queryOptions);

  useEffect(() => {
    if (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'SalesChart',
          period: selectedPeriod
        }
      });
      onError?.(error);
    }
  }, [error, onError, selectedPeriod]);

  const chartData = useMemo(() => ({
    revenue: monthlyStats?.map((stat): ChartDatum => ({
      x: stat.month,
      y: stat.revenue,
      ...stat
    })) || [],
    profit: monthlyStats?.map((stat): ChartDatum => ({
      x: stat.month,
      y: stat.profit,
      ...stat
    })) || []
  }), [monthlyStats]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const renderPeriodButton = useCallback((period: Period) => {
    const isActive = selectedPeriod === period;
    
    return (
      <AnimatedPressable
        key={period}
        style={[
          styles.periodButton,
          isActive && styles.activePeriod,
          animatedStyle
        ]}
        onPressIn={() => {
          scale.value = withSpring(0.95);
        }}
        onPressOut={() => {
          scale.value = withSpring(1);
        }}
        onPress={() => {
          scale.value = withTiming(1);
          onPeriodChange(period);
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={`Afficher les données sur ${PERIOD_LABELS[period]}`}
      >
        <Text style={[
          styles.periodText,
          isActive && styles.activePeriodText
        ]}>
          {PERIOD_LABELS[period]}
        </Text>
      </AnimatedPressable>
    );
  }, [selectedPeriod, onPeriodChange, scale]);

  const renderChart = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>Chargement des données...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.noDataContainer}>
          <Text style={[styles.noDataText, styles.errorText]}>
            Erreur de chargement des données
          </Text>
          <Text style={styles.errorDetail}>
            {error instanceof Error ? error.message : 'Erreur inconnue'}
          </Text>
        </View>
      );
    }

    if (!monthlyStats?.length) {
      return (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>
            Aucune donnée disponible pour cette période
          </Text>
        </View>
      );
    }

    const zoomContainerProps: VictoryZoomContainerProps = {
      zoomDimension: "x",
      minimumZoom: { x: 1 },
    };

    return (
      <VictoryChart
        theme={VictoryTheme.material}
        height={300}
        padding={{ top: 50, bottom: 50, left: 50, right: 50 }}
        domainPadding={{ x: 20, y: 20 }}
        containerComponent={
          <VictoryVoronoiContainer
            labels={({ datum }: { datum: ChartDatum }) => 
              `${datum.x}\nCA: ${formatCurrency(datum.revenue)}\nMarge: ${formatCurrency(datum.profit)}\n${datum.itemCount} articles`
            }
            labelComponent={
              <VictoryTooltip
                style={{ fontSize: 10 }}
                flyoutStyle={{
                  stroke: theme.colors.primary,
                  fill: theme.colors.background,
                }}
              />
            }
            {...zoomContainerProps}
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
          tickFormat={(t) => formatCurrency(t)}
          style={{
            tickLabels: { fontSize: 8, padding: 5 }
          }}
        />
        
        <VictoryLine
          data={chartData.revenue}
          animate={{
            duration: 500,
            onLoad: { duration: 500 }
          }}
          style={{
            data: { stroke: theme.colors.primary, strokeWidth: 2 }
          }}
        />
        
        <VictoryLine
          data={chartData.profit}
          animate={{
            duration: 500,
            onLoad: { duration: 500 }
          }}
          style={{
            data: { stroke: theme.colors.success, strokeWidth: 2 }
          }}
        />

        <VictoryLegend
          x={50}
          y={0}
          orientation="horizontal"
          gutter={20}
          style={{ labels: { fontSize: 10 } }}
          data={[
            { name: 'CA', symbol: { fill: theme.colors.primary } },
            { name: 'Marge', symbol: { fill: theme.colors.success } }
          ]}
        />
      </VictoryChart>
    );
  }, [monthlyStats, isLoading, error, theme]);

  return (
    <ErrorBoundary
      fallbackRender={ErrorFallback}
    >
      <Animated.View 
        style={[styles.container, { backgroundColor: theme.colors.card }]}
        accessibilityRole="summary"
        accessibilityLabel="Graphique d'évolution des ventes"
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Évolution des ventes
          </Text>
          <View style={[styles.periodSelector, { backgroundColor: theme.colors.border }]}>
            {Object.keys(PERIOD_LABELS).map((period) => 
              renderPeriodButton(period as Period)
            )}
          </View>
        </View>
        {renderChart()}
      </Animated.View>
    </ErrorBoundary>
  );
});

const styles = StyleSheet.create({
  container: {
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
  },
  periodSelector: {
    flexDirection: 'row',
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
  },
  errorText: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  errorDetail: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  }
});

SalesChart.displayName = 'SalesChart'; 