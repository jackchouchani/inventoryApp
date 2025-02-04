import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { getItems, Item } from '../database/database';
import { useRefreshStore } from '../store/refreshStore';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

interface Stats {
  totalItems: number;
  availableItems: number;
  soldItems: number;
  totalPurchaseValue: number;
  totalSellingValue: number;
  totalProfit: number;
  averageProfit: number;
}

const StatsScreen = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshTimestamp = useRefreshStore(state => state.refreshTimestamp);
  const navigation = useNavigation();

  useEffect(() => {
    loadStats();
  }, [refreshTimestamp]);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const items = await getItems();
      
      const calculatedStats = calculateStats(items);
      setStats(calculatedStats);
    } catch (err) {
      setError('Failed to load statistics. Please try again.');
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (items: Item[]): Stats => {
    const availableItems = items.filter(item => item.status === 'available');
    const soldItems = items.filter(item => item.status === 'sold');

    const totalPurchaseValue = items.reduce((sum, item) => sum + item.purchasePrice, 0);
    const totalSellingValue = items.reduce((sum, item) => sum + item.sellingPrice, 0);
    const totalProfit = totalSellingValue - totalPurchaseValue;

    return {
      totalItems: items.length,
      availableItems: availableItems.length,
      soldItems: soldItems.length,
      totalPurchaseValue,
      totalSellingValue,
      totalProfit,
      averageProfit: items.length > 0 ? totalProfit / items.length : 0,
    };
  };

  const formatCurrency = (value: number): string => {
    return `$${value.toFixed(2)}`;
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
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.title}>Statistiques</Text>
      </View>
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
});