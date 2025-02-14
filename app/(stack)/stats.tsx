import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions, Platform, Pressable } from 'react-native';
import { database } from '../../src/database/database';
import type { Item } from '../../src/types/item';
import type { Category } from '../../src/types/category';
import { useRefreshStore } from '../../src/store/refreshStore';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { VictoryLine, VictoryChart, VictoryTheme, VictoryAxis, VictoryLegend } from 'victory';
import { SalesChart } from '../../src/components/SalesChart';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, subWeeks, subYears } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Stats {
  totalItems: number;
  availableItems: number;
  soldItems: number;
  totalPurchaseValue: number;
  totalSellingValue: number;
  totalProfit: number;
  averageProfit: number;
  averageMarginPercentage: number;
  bestSellingItem: {
    name: string;
    profit: number;
    margin: number;
  } | null;
  worstSellingItem: {
    name: string;
    profit: number;
    margin: number;
  } | null;
  categoryStats: {
    categoryId: number;
    categoryName: string;
    itemCount: number;
    totalProfit: number;
    averageMargin: number;
  }[];
}

interface MonthlyStats {
  month: string;
  revenue: number;
  profit: number;
  itemCount: number;
}

interface ChartProps {
  data: {
    labels: string[];
    datasets: {
      data: number[];
      color: (opacity: number) => string;
      strokeWidth: number;
    }[];
    legend: string[];
  };
  width: number;
  height: number;
  chartConfig: {
    backgroundColor: string;
    backgroundGradientFrom: string;
    backgroundGradientTo: string;
    decimalPlaces: number;
    color: (opacity: number) => string;
    labelColor: (opacity: number) => string;
    propsForDots: {
      r: string;
      strokeWidth: string;
      stroke: string;
    };
    propsForLabels: {
      fontSize: number;
    };
  };
  bezier?: boolean;
  style?: any;
  decorator?: () => React.ReactNode;
  onDataPointClick?: (
    value: number,
    dataset: {
      data: number[];
      color: (opacity: number) => string;
      strokeWidth: number;
    },
    getColor: (opacity: number) => string,
    x: number,
    y: number,
    index: number
  ) => void;
}

const Chart: React.FC<ChartProps> = (props) => {
  const { data, width, height } = props;
  
  const formattedData = data.datasets.map((dataset, i) => ({
    data: data.labels.map((label, index) => ({
      x: label,
      y: dataset.data[index]
    })),
    color: dataset.color(1)
  }));

  return (
    <VictoryChart
      width={width}
      height={height}
      theme={VictoryTheme.material}
      domainPadding={{ x: 20 }}
    >
      <VictoryAxis
        tickFormat={(t) => t}
        style={{
          tickLabels: { angle: -45, fontSize: 8 }
        }}
      />
      <VictoryAxis
        dependentAxis
        tickFormat={(t) => `$${t}`}
      />
      {formattedData.map((dataset, index) => (
        <VictoryLine
          key={index}
          data={dataset.data}
          style={{
            data: { stroke: dataset.color }
          }}
        />
      ))}
      <VictoryLegend
        x={width - 100}
        y={50}
        orientation="vertical"
        data={data.legend.map((label, i) => ({
          name: label,
          symbol: { fill: formattedData[i].color }
        }))}
      />
    </VictoryChart>
  );
};

const StatsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const refreshTimestamp = useRefreshStore(state => state.refreshTimestamp);
  const navigation = useNavigation();
  const [tooltipPos, setTooltipPos] = useState({
    x: 0,
    y: 0,
    visible: false,
    index: 0
  });
  const isFocused = useIsFocused();

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const handlePeriodChange = useCallback((period: 'week' | 'month' | 'year') => {
    setSelectedPeriod(period);
  }, []);

  const calculateMonthlyStats = useCallback((items: Item[], period: 'week' | 'month' | 'year'): MonthlyStats[] => {
    // Vérifier si nous avons des articles
    if (!items || items.length === 0) {
      return [];
    }

    const now = new Date();
    let startDate: Date;

    // Définir la période de début
    switch (period) {
      case 'week':
        startDate = subWeeks(now, 1);
        break;
      case 'month':
        startDate = subMonths(now, 1);
        break;
      case 'year':
        startDate = subYears(now, 1);
        break;
      default:
        startDate = subMonths(now, 1);
    }

    // Filtrer les articles vendus
    const soldItems = items.filter(item => {
      if (item.status !== 'sold') return false;
      if (!item.soldAt) return false;

      try {
        const soldDate = new Date(item.soldAt);
        // Vérifier si la date est valide
        if (isNaN(soldDate.getTime())) {
          console.error('Date invalide:', item.soldAt);
          return false;
        }
        return soldDate >= startDate && soldDate <= now;
      } catch (error) {
        console.error('Erreur de parsing de date:', error, item.soldAt);
        return false;
      }
    });

    const stats: { [key: string]: MonthlyStats } = {};

    // Traiter chaque article vendu
    soldItems.forEach(item => {
      if (!item.soldAt) return;

      try {
        const soldDate = new Date(item.soldAt);
        let key: string;
        
        // Formater la clé selon la période
        switch (period) {
          case 'week':
            key = format(soldDate, 'EEE', { locale: fr }).toLowerCase();
            break;
          case 'month':
            key = format(soldDate, 'dd/MM', { locale: fr });
            break;
          case 'year':
            key = format(soldDate, 'MMM', { locale: fr }).toLowerCase();
            break;
        }

        // Initialiser ou mettre à jour les statistiques
        if (!stats[key]) {
          stats[key] = {
            month: key,
            revenue: 0,
            profit: 0,
            itemCount: 0
          };
        }

        // Ajouter les valeurs
        stats[key].revenue += item.sellingPrice || 0;
        stats[key].profit += (item.sellingPrice || 0) - (item.purchasePrice || 0);
        stats[key].itemCount += 1;
      } catch (error) {
        console.error('Erreur lors du traitement de l\'article:', error, item);
      }
    });

    // Convertir l'objet stats en tableau et trier
    const sortedStats = Object.values(stats).sort((a, b) => {
      if (period === 'week') {
        const weekDays = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
        return weekDays.indexOf(a.month) - weekDays.indexOf(b.month);
      }
      return a.month.localeCompare(b.month);
    });

    setMonthlyStats(sortedStats);
    return sortedStats;
  }, []);

  const calculateStats = useCallback((items: Item[], categories: Category[]): Stats => {
    const availableItems = items.filter(item => item.status === 'available');
    const soldItems = items.filter(item => item.status === 'sold');

    const totalPurchaseValue = items.reduce((sum, item) => sum + item.purchasePrice, 0);
    const totalSellingValue = items.reduce((sum, item) => sum + item.sellingPrice, 0);
    const totalProfit = totalSellingValue - totalPurchaseValue;

    const itemsWithMargins = soldItems.map(item => ({
      ...item,
      profit: item.sellingPrice - item.purchasePrice,
      margin: ((item.sellingPrice - item.purchasePrice) / item.purchasePrice) * 100
    }));

    const bestSellingItem = itemsWithMargins.length > 0
      ? itemsWithMargins.reduce((best, current) => 
          current.profit > best.profit ? current : best
        )
      : null;

    const worstSellingItem = itemsWithMargins.length > 0
      ? itemsWithMargins.reduce((worst, current) => 
          current.profit < worst.profit ? current : worst
        )
      : null;

    const categoryStats = categories.map(category => {
      const categoryItems = items.filter(item => item.categoryId === category.id);
      const categoryProfit = categoryItems.reduce((sum, item) => 
        sum + (item.sellingPrice - item.purchasePrice), 0);
      const categoryRevenue = categoryItems.reduce((sum, item) => 
        sum + item.sellingPrice, 0);

      return {
        categoryId: category.id,
        categoryName: category.name,
        itemCount: categoryItems.length,
        totalProfit: categoryProfit,
        averageMargin: categoryItems.length > 0 
          ? (categoryProfit / categoryRevenue) * 100 
          : 0
      };
    });

    return {
      totalItems: items.length,
      availableItems: availableItems.length,
      soldItems: soldItems.length,
      totalPurchaseValue,
      totalSellingValue,
      totalProfit,
      averageProfit: soldItems.length > 0 ? totalProfit / soldItems.length : 0,
      averageMarginPercentage: soldItems.length > 0 
        ? (itemsWithMargins.reduce((sum, item) => sum + item.margin, 0) / soldItems.length)
        : 0,
      bestSellingItem: bestSellingItem ? {
        name: bestSellingItem.name,
        profit: bestSellingItem.profit,
        margin: bestSellingItem.margin
      } : null,
      worstSellingItem: worstSellingItem ? {
        name: worstSellingItem.name,
        profit: worstSellingItem.profit,
        margin: worstSellingItem.margin
      } : null,
      categoryStats
    };
  }, []);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [loadedItems, loadedCategories] = await Promise.all([
        database.getItems(),
        database.getCategories()
      ]);

      setItems(loadedItems);
      setCategories(loadedCategories);

      const calculatedStats = calculateStats(loadedItems, loadedCategories);
      setStats(calculatedStats);

      const calculatedMonthlyStats = calculateMonthlyStats(loadedItems, selectedPeriod);
      setMonthlyStats(calculatedMonthlyStats);
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
      setError('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, calculateStats, calculateMonthlyStats]);

  const updateSoldItemsWithoutDate = useCallback(async (items: Item[]) => {
    const soldItemsWithoutDate = items.filter(item => 
      item.status === 'sold' && !item.soldAt
    );

    if (soldItemsWithoutDate.length > 0) {      
      try {
        const now = new Date().toISOString();
        await Promise.all(
          soldItemsWithoutDate.map(item =>
            database.updateItem(item.id, {
              status: 'sold',
              soldAt: now
            })
          )
        );
        
        // Recharger les données après la mise à jour
        await loadStats();
      } catch (error) {
        console.error('Erreur lors de la mise à jour des dates de vente:', error);
      }
    }
  }, [loadStats]);

  const initializeData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [loadedItems, loadedCategories] = await Promise.all([
        database.getItems(),
        database.getCategories()
      ]);
      setItems(loadedItems);
      setCategories(loadedCategories);

      const calculatedStats = calculateStats(loadedItems, loadedCategories);
      setStats(calculatedStats);

      const calculatedMonthlyStats = calculateMonthlyStats(loadedItems, selectedPeriod);
      setMonthlyStats(calculatedMonthlyStats);
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
      setError('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, calculateStats, calculateMonthlyStats]);

  // Chargement initial des données
  useEffect(() => {
    if (isFocused) {
      initializeData();
    }
  }, [isFocused, initializeData, refreshTimestamp]);

  // Mise à jour des données lorsque la période change
  useEffect(() => {
    if (isFocused) {
      loadStats();
    }
  }, [selectedPeriod, isFocused, loadStats]);

  const renderMonthlyChart = () => {
    if (!stats) return null;

    const screenWidth = Dimensions.get('window').width;

    const chartData = {
      labels: monthlyStats.map(stat => stat.month),
      datasets: [
        {
          data: monthlyStats.map(stat => stat.revenue),
          color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
          strokeWidth: 2
        },
        {
          data: monthlyStats.map(stat => stat.profit),
          color: (opacity = 1) => `rgba(52, 199, 89, ${opacity})`,
          strokeWidth: 2
        }
      ],
      legend: ['CA', 'Marge']
    };

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Évolution des ventes</Text>
        <ScrollView horizontal={false} showsHorizontalScrollIndicator={false}>
          <Chart
            data={chartData}
            width={screenWidth - 40}
            height={220}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              propsForDots: {
                r: "6",
                strokeWidth: "2",
                stroke: "#ffa726"
              },
              propsForLabels: {
                fontSize: 12
              }
            }}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16
            }}
            decorator={() => {
              return tooltipPos.visible ? (
                <View style={{
                  position: 'absolute',
                  left: tooltipPos.x - 35,
                  top: tooltipPos.y - 70,
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  padding: 8,
                  borderRadius: 6
                }}>
                  <Text style={{ color: 'white', fontSize: 12 }}>
                    CA: {formatCurrency(monthlyStats[tooltipPos.index].revenue)}
                  </Text>
                  <Text style={{ color: 'white', fontSize: 12 }}>
                    Marge: {formatCurrency(monthlyStats[tooltipPos.index].profit)}
                  </Text>
                  <Text style={{ color: 'white', fontSize: 12 }}>
                    Ventes: {monthlyStats[tooltipPos.index].itemCount}
                  </Text>
                </View>
              ) : null;
            }}
            onDataPointClick={(
              value: number,
              dataset: {
                data: number[];
                color: (opacity: number) => string;
                strokeWidth: number;
              },
              getColor: (opacity: number) => string,
              x: number,
              y: number,
              index: number
            ) => {
              setTooltipPos({
                x,
                y,
                visible: true,
                index
              });
            }}
          />
        </ScrollView>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vue d'ensemble</Text>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats?.totalItems || 0}</Text>
              <Text style={styles.statLabel}>Total Articles</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats?.availableItems || 0}</Text>
              <Text style={styles.statLabel}>Disponibles</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats?.soldItems || 0}</Text>
              <Text style={styles.statLabel}>Vendus</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Résumé Financier</Text>
          <View style={styles.financialStats}>
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Valeur d'Achat Totale:</Text>
              <Text style={styles.financialValue}>
                {formatCurrency(stats?.totalPurchaseValue || 0)}
              </Text>
            </View>
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Valeur de Vente Totale:</Text>
              <Text style={styles.financialValue}>
                {formatCurrency(stats?.totalSellingValue || 0)}
              </Text>
            </View>
            <View style={styles.financialRow}>
              <Text style={[styles.financialLabel, styles.totalProfitLabel]}>Bénéfice Total:</Text>
              <Text style={[styles.financialValue, styles.totalProfitValue]}>
                {formatCurrency(stats?.totalProfit || 0)}
              </Text>
            </View>
          </View>
        </View>

        <SalesChart 
          monthlyStats={monthlyStats}
          selectedPeriod={selectedPeriod}
          onPeriodChange={handlePeriodChange}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance par Catégorie</Text>
          {stats?.categoryStats.map((catStat, index) => (
            <View key={catStat.categoryId} style={styles.categoryRow}>
              <View style={styles.categoryNameContainer}>
                <Text style={styles.categoryName}>{catStat.categoryName}</Text>
                <Text style={styles.itemCount}>{catStat.itemCount} articles</Text>
              </View>
              <View style={styles.categoryStats}>
                <View style={styles.categoryStatItem}>
                  <Text style={styles.categoryStatLabel}>Chiffre d'affaires</Text>
                  <Text style={styles.categoryValue}>
                    {formatCurrency(catStat.totalProfit)}
                  </Text>
                </View>
                <View style={styles.categoryStatItem}>
                  <Text style={styles.categoryStatLabel}>Marge</Text>
                  <Text style={styles.categoryMargin}>
                    {catStat.averageMargin.toFixed(1)}%
                  </Text>
                </View>
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
    flex: 1,
    backgroundColor: '#fff',
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
    padding: 20,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  financialStats: {
    gap: 12,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  financialLabel: {
    fontSize: 14,
    color: '#666',
  },
  financialValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  totalProfitLabel: {
    color: '#1a1a1a',
    fontWeight: '600',
  },
  totalProfitValue: {
    color: '#34C759',
    fontSize: 18,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryNameContainer: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  itemCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  categoryStats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  categoryStatItem: {
    alignItems: 'flex-end',
  },
  categoryStatLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  categoryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  categoryMargin: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34C759',
  },
});

export default StatsScreen;