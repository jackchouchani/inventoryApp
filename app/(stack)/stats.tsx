import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { getItems, Item } from '../../src/database/database';
import { getCategories, Category } from '../../src/database/database';
import { useRefreshStore } from '../../src/store/refreshStore';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { VictoryLine, VictoryChart, VictoryTheme, VictoryAxis, VictoryLegend } from 'victory';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
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
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const refreshTimestamp = useRefreshStore(state => state.refreshTimestamp);
  const navigation = useNavigation();
  const [tooltipPos, setTooltipPos] = useState({
    x: 0,
    y: 0,
    visible: false,
    index: 0
  });

  useEffect(() => {
    loadStats();
  }, [refreshTimestamp]);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const [items, loadedCategories] = await Promise.all([
        getItems(),
        getCategories()
      ]);
      setCategories(loadedCategories);
      const calculatedStats = calculateStats(items, loadedCategories);
      const calculatedMonthlyStats = calculateMonthlyStats(items);
      setMonthlyStats(calculatedMonthlyStats);
      setStats(calculatedStats);
    } catch (err) {
      setError('Failed to load statistics. Please try again.');
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (items: Item[], categories: Category[]): Stats => {
    const availableItems = items.filter(item => item.status === 'available');
    const soldItems = items.filter(item => item.status === 'sold');

    const totalPurchaseValue = items.reduce((sum, item) => sum + item.purchasePrice, 0);
    const totalSellingValue = items.reduce((sum, item) => sum + item.sellingPrice, 0);
    const totalProfit = totalSellingValue - totalPurchaseValue;

    // Calcul des marges par item
    const itemsWithMargins = soldItems.map(item => ({
      ...item,
      profit: item.sellingPrice - item.purchasePrice,
      margin: ((item.sellingPrice - item.purchasePrice) / item.purchasePrice) * 100
    }));

    // Meilleure et pire vente
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

    // Fonction utilitaire pour obtenir le nom de la catégorie
    const getCategoryName = (item: Item): string => {
      const category = categories.find((cat: Category) => cat.id === item.categoryId);
      return category?.name || 'Sans catégorie';
    };

    // Statistiques par catégorie
    const categoryStats = items.reduce((stats, item) => {
      const categoryId = item.categoryId ?? 0;
      const categoryIndex = stats.findIndex(s => s.categoryId === categoryId);

      if (categoryIndex === -1) {
        stats.push({
          categoryId: categoryId,
          categoryName: getCategoryName(item),
          itemCount: 1,
          totalProfit: item.sellingPrice - item.purchasePrice,
          averageMargin: ((item.sellingPrice - item.purchasePrice) / item.purchasePrice) * 100
        });
      } else {
        stats[categoryIndex].itemCount++;
        stats[categoryIndex].totalProfit += (item.sellingPrice - item.purchasePrice);
        stats[categoryIndex].averageMargin = (stats[categoryIndex].totalProfit / stats[categoryIndex].itemCount);
      }
      return stats;
    }, [] as Stats['categoryStats']);

    return {
      totalItems: items.length,
      availableItems: availableItems.length,
      soldItems: soldItems.length,
      totalPurchaseValue,
      totalSellingValue,
      totalProfit,
      averageProfit: items.length > 0 ? totalProfit / items.length : 0,
      averageMarginPercentage: soldItems.length > 0 
        ? itemsWithMargins.reduce((sum, item) => sum + item.margin, 0) / soldItems.length 
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
  };

  const calculateMonthlyStats = (items: Item[]): MonthlyStats[] => {
    // Obtenir les 12 derniers mois
    const endDate = new Date();
    const startDate = subMonths(endDate, 11);
    const months = eachMonthOfInterval({ start: startDate, end: endDate });

    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      const soldItemsInMonth = items.filter(item => 
        item.soldAt && 
        parseISO(item.soldAt) >= monthStart && 
        parseISO(item.soldAt) <= monthEnd
      );

      const revenue = soldItemsInMonth.reduce((sum, item) => sum + item.sellingPrice, 0);
      const profit = soldItemsInMonth.reduce((sum, item) => 
        sum + (item.sellingPrice - item.purchasePrice), 0
      );

      return {
        month: format(month, 'MMM yyyy', { locale: fr }),
        revenue,
        profit,
        itemCount: soldItemsInMonth.length
      };
    });
  };

  const formatCurrency = (value: number): string => {
    return `$${value.toFixed(2)}`;
  };

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
        <Text style={styles.loadingText}>Loading statistics...</Text>
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
              <Text style={styles.statLabel}>Total Items</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats?.availableItems || 0}</Text>
              <Text style={styles.statLabel}>Available</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats?.soldItems || 0}</Text>
              <Text style={styles.statLabel}>Sold</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Summary</Text>
          <View style={styles.financialStats}>
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Total Purchase Value:</Text>
              <Text style={styles.financialValue}>
                {formatCurrency(stats?.totalPurchaseValue || 0)}
              </Text>
            </View>
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Total Selling Value:</Text>
              <Text style={styles.financialValue}>
                {formatCurrency(stats?.totalSellingValue || 0)}
              </Text>
            </View>
            <View style={styles.financialRow}>
              <Text style={[styles.financialLabel, styles.totalProfitLabel]}>Total Profit:</Text>
              <Text style={[styles.financialValue, styles.totalProfitValue]}>
                {formatCurrency(stats?.totalProfit || 0)}
              </Text>
            </View>
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Average Profit per Item:</Text>
              <Text style={styles.financialValue}>
                {formatCurrency(stats?.averageProfit || 0)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance des Ventes</Text>
          <View style={styles.performanceStats}>
            <View style={styles.performanceRow}>
              <Text style={styles.performanceLabel}>Marge Moyenne:</Text>
              <Text style={styles.performanceValue}>
                {stats?.averageMarginPercentage.toFixed(1)}%
              </Text>
            </View>
            
            {stats?.bestSellingItem && (
              <View style={styles.performanceRow}>
                <Text style={styles.performanceLabel}>Meilleure Vente:</Text>
                <View>
                  <Text style={styles.performanceValue}>{stats.bestSellingItem.name}</Text>
                  <Text style={styles.performanceSubtext}>
                    Profit: {formatCurrency(stats.bestSellingItem.profit)}
                  </Text>
                </View>
              </View>
            )}

            {stats?.worstSellingItem && (
              <View style={styles.performanceRow}>
                <Text style={styles.performanceLabel}>Vente la Moins Rentable:</Text>
                <View>
                  <Text style={styles.performanceValue}>{stats.worstSellingItem.name}</Text>
                  <Text style={styles.performanceSubtext}>
                    Profit: {formatCurrency(stats.worstSellingItem.profit)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistiques par Catégorie</Text>
          {stats?.categoryStats.map((catStat, index) => (
            <View key={index} style={styles.categoryRow}>
              <Text style={styles.categoryName}>{catStat.categoryName}</Text>
              <View style={styles.categoryStats}>
                <View style={styles.categoryStatItem}>
                  <Text style={styles.categoryStatValue}>{catStat.itemCount}</Text>
                  <Text style={styles.categoryStatLabel}>Articles</Text>
                </View>
                <View style={styles.categoryStatItem}>
                  <Text style={styles.categoryStatValue}>
                    {formatCurrency(catStat.totalProfit)}
                  </Text>
                  <Text style={styles.categoryStatLabel}>Profit Total</Text>
                </View>
                <View style={styles.categoryStatItem}>
                  <Text style={styles.categoryStatValue}>
                    {catStat.averageMargin.toFixed(1)}%
                  </Text>
                  <Text style={styles.categoryStatLabel}>Marge Moy.</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {renderMonthlyChart()}
      </ScrollView>
    </View>
  );
};

export default StatsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    height: 60,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 16,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#000',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -10,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
    marginHorizontal: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  financialStats: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  financialLabel: {
    fontSize: 16,
    color: '#333',
  },
  financialValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalProfitLabel: {
    fontWeight: 'bold',
    color: '#000',
  },
  totalProfitValue: {
    color: '#34c759',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 16,
    textAlign: 'center',
  },
  performanceStats: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  performanceLabel: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  performanceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  performanceSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'right',
  },
  categoryRow: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  categoryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  categoryStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  categoryStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  categoryStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});