import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { Container } from '../types/container';

interface ContainerStatData {
  container: Container;
  count: number;
}

interface ContainerBarChartProps {
  data: ContainerStatData[];
  height?: number;
  showValues?: boolean;
}

const ContainerBarChart: React.FC<ContainerBarChartProps> = ({
  data,
  height = 250,
  showValues = true
}) => {
  // Convertir hex en RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  // Générer la couleur de la barre basée sur la valeur
  const getBarColor = (index: number, value: number, maxValue: number) => {
    const intensity = Math.max(0.3, value / maxValue); // Minimum 30% d'intensité
    const baseColors = [
      '#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D92',
      '#5AC8FA', '#FFCC02', '#FF3B30', '#8E8E93', '#00C7BE'
    ];
    const baseColor = baseColors[index % baseColors.length];
    
    // Créer une version avec l'intensité appropriée
    const rgb = hexToRgb(baseColor);
    if (rgb) {
      return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity})`;
    }
    return baseColor;
  };

  const getGradientColor = (index: number, value: number, maxValue: number) => {
    const intensity = Math.max(0.1, (value / maxValue) * 0.7); // Plus doux pour le gradient
    const baseColors = [
      '#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D92',
      '#5AC8FA', '#FFCC02', '#FF3B30', '#8E8E93', '#00C7BE'
    ];
    const baseColor = baseColors[index % baseColors.length];
    
    const rgb = hexToRgb(baseColor);
    if (rgb) {
      return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity})`;
    }
    return baseColor;
  };

  // Préparer les données pour le graphique en barres
  const barData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Filtrer et trier les containers par nombre d'articles
    const validContainers = data
      .filter(containerStat => containerStat.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Limiter à 10 containers max

    const maxValue = Math.max(...validContainers.map(c => c.count), 1);

    return validContainers.map((containerStat, index) => ({
      value: containerStat.count,
      label: containerStat.container.name.length > 8 
        ? containerStat.container.name.substring(0, 8) + '...' 
        : containerStat.container.name,
      frontColor: getBarColor(index, containerStat.count, maxValue),
      gradientColor: getGradientColor(index, containerStat.count, maxValue),
      spacing: 8,
      labelWidth: 60,
      labelTextStyle: {
        color: '#666',
        fontSize: 9,
        textAlign: 'center',
      },
      topLabelComponent: showValues ? () => (
        <Text style={styles.valueLabel}>{containerStat.count}</Text>
      ) : undefined,
      containerName: containerStat.container.name,
      containerNumber: containerStat.container.number,
    }));
  }, [data, showValues]);

  // Calculs des statistiques
  const totalContainers = barData.length;
  const totalItems = useMemo(() => 
    barData.reduce((sum, item) => sum + item.value, 0), 
    [barData]
  );
  const averageItems = totalItems > 0 ? Math.round(totalItems / totalContainers) : 0;

  if (!barData || barData.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Aucune donnée de container disponible</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Statistiques en haut */}
      <View style={styles.statsHeader}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalContainers}</Text>
          <Text style={styles.statLabel}>Containers Utilisés</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalItems}</Text>
          <Text style={styles.statLabel}>Articles Totaux</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#34C759' }]}>{averageItems}</Text>
          <Text style={styles.statLabel}>Moyenne/Container</Text>
        </View>
      </View>

      {/* Graphique en barres */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chartContainer}>
          <BarChart
            data={barData}
            barWidth={32}
            spacing={16}
            roundedTop
            roundedBottom
            hideRules
            xAxisThickness={1}
            yAxisThickness={1}
            xAxisColor="#E5E5EA"
            yAxisColor="#E5E5EA"
            yAxisTextStyle={{
              color: '#666',
              fontSize: 10,
            }}
            showGradient
            height={height - 80}
            maxValue={Math.max(...barData.map(d => d.value)) * 1.1}
            noOfSections={4}
            isAnimated
            animationDuration={800}
          />
        </View>
      </ScrollView>

      {/* Légende avec noms des containers */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.legendContainer}>
          {barData.map((item, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: item.frontColor }]} />
              <View style={styles.legendTextContainer}>
                <Text style={styles.legendNumber}>#{item.containerNumber}</Text>
                <Text style={styles.legendName} numberOfLines={1}>
                  {item.containerName}
                </Text>
                <Text style={styles.legendCount}>{item.value} articles</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 16,
  },
  emptyContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 8,
    marginHorizontal: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  chartContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  valueLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
    textAlign: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  legendItem: {
    alignItems: 'center',
    width: 80,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 8,
  },
  legendColor: {
    width: 20,
    height: 4,
    borderRadius: 2,
    marginBottom: 6,
  },
  legendTextContainer: {
    alignItems: 'center',
    width: '100%',
  },
  legendNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 2,
  },
  legendName: {
    fontSize: 10,
    color: '#333',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 2,
    width: '100%',
  },
  legendCount: {
    fontSize: 9,
    color: '#666',
    textAlign: 'center',
  },
});

export default ContainerBarChart; 