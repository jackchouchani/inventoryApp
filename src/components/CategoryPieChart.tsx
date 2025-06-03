import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { formatCurrency } from '../utils/formatters';

interface CategoryData {
  categoryId: number;
  categoryName: string;
  itemCount: number;
  totalProfit: number;
  averageMargin: number;
}

interface CategoryPieChartProps {
  data: CategoryData[];
  showValues?: boolean;
  height?: number;
}

const CategoryPieChart: React.FC<CategoryPieChartProps> = ({
  data,
  showValues = true,
  height = 200
}) => {
  // Générer des couleurs pour chaque catégorie
  const generateColor = (index: number) => {
    const colors = [
      '#007AFF', // Bleu primaire
      '#34C759', // Vert
      '#FF9500', // Orange
      '#AF52DE', // Violet
      '#FF2D92', // Rose
      '#5AC8FA', // Bleu clair
      '#FFCC02', // Jaune
      '#FF3B30', // Rouge
      '#8E8E93', // Gris
      '#00C7BE', // Turquoise
    ];
    return colors[index % colors.length];
  };

  // Préparer les données pour le graphique
  const pieData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Filtrer les catégories avec des items et trier par bénéfice
    const validCategories = data
      .filter(category => category.itemCount > 0)
      .sort((a, b) => b.totalProfit - a.totalProfit);

    // Limiter à 8 catégories max pour la lisibilité
    const topCategories = validCategories.slice(0, 8);
    
    // Calculer le total pour les pourcentages
    const totalProfit = topCategories.reduce((sum, cat) => sum + cat.totalProfit, 0);

    return topCategories.map((category, index) => ({
      value: category.totalProfit,
      color: generateColor(index),
      text: `${((category.totalProfit / totalProfit) * 100).toFixed(1)}%`,
      textColor: '#666',
      textSize: 12,
      category: category.categoryName,
      itemCount: category.itemCount,
      profit: category.totalProfit,
      margin: category.averageMargin,
    }));
  }, [data]);

  // Calcul des totaux
  const totalProfit = useMemo(() => 
    pieData.reduce((sum, item) => sum + item.value, 0), 
    [pieData]
  );

  const totalItems = useMemo(() => 
    pieData.reduce((sum, item) => sum + item.itemCount, 0), 
    [pieData]
  );

  if (!pieData || pieData.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Aucune donnée de catégorie disponible</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Statistiques en haut */}
      <View style={styles.statsHeader}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{pieData.length}</Text>
          <Text style={styles.statLabel}>Catégories</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalItems}</Text>
          <Text style={styles.statLabel}>Articles</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#34C759' }]}>
            {formatCurrency(totalProfit)}
          </Text>
          <Text style={styles.statLabel}>Bénéfice Total</Text>
        </View>
      </View>

      {/* Graphique en camembert */}
      <View style={styles.chartContainer}>
        <PieChart
          data={pieData}
          radius={height / 2.5}
          centerLabelComponent={() => (
            <View style={styles.centerLabel}>
              <Text style={styles.centerValue}>{pieData.length}</Text>
              <Text style={styles.centerText}>Catégories</Text>
            </View>
          )}
          showText={showValues}
          textColor="#666"
          textSize={10}
          strokeColor="white"
          strokeWidth={2}
          donut
          innerRadius={height / 6}
          showTooltip
          focusOnPress
          isAnimated
          animationDuration={800}
        />
      </View>

      {/* Légende */}
      <View style={styles.legendContainer}>
        {pieData.map((item, index) => (
          <View key={index} style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: item.color }]} />
            <View style={styles.legendTextContainer}>
              <Text style={styles.legendCategory}>{item.category}</Text>
              <Text style={styles.legendDetails}>
                {item.itemCount} articles • {formatCurrency(item.profit)}
              </Text>
            </View>
            <Text style={styles.legendPercentage}>{item.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 16,
  },
  emptyContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 8,
    width: '90%',
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
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  centerLabel: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
  },
  centerText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  legendContainer: {
    width: '100%',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  legendTextContainer: {
    flex: 1,
  },
  legendCategory: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  legendDetails: {
    fontSize: 12,
    color: '#666',
  },
  legendPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    minWidth: 40,
    textAlign: 'right',
  },
});

export default CategoryPieChart; 