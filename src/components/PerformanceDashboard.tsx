import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { monitoring } from '../services/monitoring';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width;

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
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const report = await monitoring.getPerformanceReport();
      setData(report);
    } catch (error) {
      console.error('Erreur lors du chargement des données de performance:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196f3" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.errorContainer}>
        <Text>Erreur lors du chargement des données</Text>
      </View>
    );
  }

  const chartConfig = {
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
  };

  const errorRateData = {
    labels: ['API', 'Rendu', 'BD'],
    datasets: [
      {
        data: [data.errorRate.api, data.errorRate.render, data.errorRate.db],
      },
    ],
  };

  const performanceData = {
    labels: ['API', 'Rendu', 'BD'],
    datasets: [
      {
        data: [
          data.summary.apiCalls.averageDuration,
          data.summary.renders.averageDuration,
          data.summary.dbOperations.averageDuration,
        ],
      },
    ],
  };

  return (
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

export default PerformanceDashboard; 