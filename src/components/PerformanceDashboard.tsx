import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { monitoring } from '../services/monitoring';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useQuery } from '@tanstack/react-query';

interface PerformanceData {
  summary: {
    apiCalls: { count: number; averageDuration: number; errors: number };
    renders: { count: number; averageDuration: number; errors: number };
    dbOperations: { count: number; averageDuration: number; errors: number };
  };
  slowestOperations: Array<{
    type: string;
    name: string;
    duration: number;
  }>;
  errorRate: {
    api: number;
    render: number;
    db: number;
  };
  performanceScore: number;
}

const PerformanceDashboard: React.FC = () => {
  const { width: screenWidth } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<PerformanceData>({
    queryKey: ['performanceReport'],
    queryFn: () => monitoring.getPerformanceReport(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 24 * 60 * 60 * 1000, // 24 heures
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const chartConfig = useMemo(() => ({
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#ffa726',
    },
  }), []);

  const errorRateData = useMemo(() => ({
    labels: ['API', 'Rendu', 'BD'],
    datasets: [{
      data: data ? [data.errorRate.api, data.errorRate.render, data.errorRate.db] : [0, 0, 0],
    }],
  }), [data]);

  const performanceData = useMemo(() => ({
    labels: ['API', 'Rendu', 'BD'],
    datasets: [{
      data: data ? [
        data.summary.apiCalls.averageDuration,
        data.summary.renders.averageDuration,
        data.summary.dbOperations.averageDuration,
      ] : [0, 0, 0],
    }],
  }), [data]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196f3" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text>Erreur lors du chargement des données</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.errorContainer}>
        <Text>Aucune donnée disponible</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreTitle}>Score de Performance</Text>
          <Text style={styles.scoreValue}>
            {Math.round(data.performanceScore)}%
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Taux d'Erreur</Text>
          <BarChart
            data={errorRateData}
            width={screenWidth - 32}
            height={220}
            yAxisLabel=""
            yAxisSuffix="%"
            chartConfig={chartConfig}
            style={styles.chart}
            verticalLabelRotation={30}
            showValuesOnTopOfBars
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Durée Moyenne (ms)</Text>
          <LineChart
            data={performanceData}
            width={screenWidth - 32}
            height={220}
            yAxisLabel=""
            yAxisSuffix=" ms"
            chartConfig={chartConfig}
            style={styles.chart}
            bezier
            verticalLabelRotation={30}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Opérations les Plus Lentes</Text>
          {data.slowestOperations.map((op, index) => (
            <View key={index} style={styles.operationItem}>
              <Text style={styles.operationType}>{op.type}</Text>
              <Text style={styles.operationName}>{op.name}</Text>
              <Text style={styles.operationDuration}>{op.duration}ms</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Résumé</Text>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>API Calls:</Text>
            <Text style={styles.summaryValue}>
              {data.summary.apiCalls.count} appels
              ({data.summary.apiCalls.errors} erreurs)
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Rendus:</Text>
            <Text style={styles.summaryValue}>
              {data.summary.renders.count} rendus
              ({data.summary.renders.errors} erreurs)
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Opérations DB:</Text>
            <Text style={styles.summaryValue}>
              {data.summary.dbOperations.count} opérations
              ({data.summary.dbOperations.errors} erreurs)
            </Text>
          </View>
        </View>
      </ScrollView>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  },
  scoreContainer: {
    backgroundColor: '#2196f3',
    padding: 20,
    alignItems: 'center',
    margin: 16,
    borderRadius: 8,
  },
  scoreTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scoreValue: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 8,
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  operationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  operationType: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  operationName: {
    flex: 2,
    fontSize: 14,
  },
  operationDuration: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196f3',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default React.memo(PerformanceDashboard); 