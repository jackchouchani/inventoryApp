import React, { useMemo } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { 
  Text, 
  Card, 
  Title, 
  Chip,
  DataTable,
  IconButton,
  Divider,
  List
} from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { useSourceOptimized } from '../../../src/hooks/useSourcesOptimized';
import { useFilteredItems } from '../../../src/hooks/useOptimizedSelectors';
import StyleFactory from '../../../src/styles/StyleFactory';
import { useAppTheme } from '../../../src/contexts/ThemeContext';
import { CommonHeader } from '../../../src/components';

export default function SourceDetailScreen() {
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'SourceDetailScreen');
  const { id } = useLocalSearchParams<{ id: string }>();
  const sourceId = parseInt(id || '0', 10);
  
  const { source } = useSourceOptimized(sourceId);
  const items = useFilteredItems({ sourceId });

  // Calculer les statistiques
  const stats = useMemo(() => {
    const totalItems = items.length;
    const soldItems = items.filter(item => item.status === 'sold');
    const availableItems = items.filter(item => item.status === 'available');
    
    const totalRevenue = soldItems.reduce((sum, item) => sum + item.sellingPrice, 0);
    const totalCost = items.reduce((sum, item) => sum + item.purchasePrice, 0);
    const totalProfit = totalRevenue - soldItems.reduce((sum, item) => sum + item.purchasePrice, 0);
    
    const roi = soldItems.length > 0 ? (totalProfit / soldItems.reduce((sum, item) => sum + item.purchasePrice, 0)) * 100 : 0;
    
    // Calculer le temps moyen de vente
    const soldItemsWithDates = soldItems.filter(item => item.soldAt && item.createdAt);
    const averageDaysToSell = soldItemsWithDates.length > 0 
      ? soldItemsWithDates.reduce((sum, item) => {
          const created = new Date(item.createdAt);
          const sold = new Date(item.soldAt!);
          return sum + Math.floor((sold.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        }, 0) / soldItemsWithDates.length
      : 0;

    return {
      totalItems,
      soldItems: soldItems.length,
      availableItems: availableItems.length,
      totalRevenue,
      totalCost,
      totalProfit,
      roi,
      averageDaysToSell,
    };
  }, [items]);

  const handleEdit = () => {
    router.push(`/sources/${sourceId}/edit`);
  };

  const handleItemPress = (itemId: number) => {
    router.push(`/item/${itemId}/info`);
  };

  if (!source) {
    return (
      <View style={styles.container}>
        <Text>Source non trouvée</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CommonHeader 
        title={source?.name || 'Source'}
        onBackPress={() => router.back()}
      />
      
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.content}>
      {/* En-tête de la source */}
      <Card style={styles.headerCard}>
        <Card.Content>
          <View style={styles.header}>
            <View style={styles.sourceInfo}>
              <Title style={styles.sourceName}>{source.name}</Title>
              <View style={styles.sourceDetails}>
                <Chip mode="outlined" compact>{source.type}</Chip>
                {source.city && (
                  <Text style={styles.cityText}>{source.city}</Text>
                )}
              </View>
            </View>
            <IconButton
              icon="pencil"
              mode="outlined"
              onPress={handleEdit}
            />
          </View>
        </Card.Content>
      </Card>

      {/* Statistiques */}
      <Card style={styles.statsCard}>
        <Card.Content>
          <Title>Statistiques</Title>
          <DataTable>
            <DataTable.Row>
              <DataTable.Cell>Articles total</DataTable.Cell>
              <DataTable.Cell numeric>{stats.totalItems}</DataTable.Cell>
            </DataTable.Row>
            <DataTable.Row>
              <DataTable.Cell>Articles vendus</DataTable.Cell>
              <DataTable.Cell numeric>{stats.soldItems}</DataTable.Cell>
            </DataTable.Row>
            <DataTable.Row>
              <DataTable.Cell>Articles disponibles</DataTable.Cell>
              <DataTable.Cell numeric>{stats.availableItems}</DataTable.Cell>
            </DataTable.Row>
            <Divider />
            <DataTable.Row>
              <DataTable.Cell>Chiffre d'affaires</DataTable.Cell>
              <DataTable.Cell numeric>{stats.totalRevenue.toFixed(2)} €</DataTable.Cell>
            </DataTable.Row>
            <DataTable.Row>
              <DataTable.Cell>Coût total</DataTable.Cell>
              <DataTable.Cell numeric>{stats.totalCost.toFixed(2)} €</DataTable.Cell>
            </DataTable.Row>
            <DataTable.Row>
              <DataTable.Cell>Profit total</DataTable.Cell>
              <DataTable.Cell numeric style={[
                { color: stats.totalProfit >= 0 ? activeTheme.primary : activeTheme.error }
              ]}>
                {stats.totalProfit.toFixed(2)} €
              </DataTable.Cell>
            </DataTable.Row>
            <DataTable.Row>
              <DataTable.Cell>ROI moyen</DataTable.Cell>
              <DataTable.Cell numeric style={[
                { color: stats.roi >= 0 ? activeTheme.primary : activeTheme.error }
              ]}>
                {stats.roi.toFixed(1)} %
              </DataTable.Cell>
            </DataTable.Row>
            {stats.averageDaysToSell > 0 && (
              <DataTable.Row>
                <DataTable.Cell>Temps de vente moyen</DataTable.Cell>
                <DataTable.Cell numeric>{Math.round(stats.averageDaysToSell)} jours</DataTable.Cell>
              </DataTable.Row>
            )}
          </DataTable>
        </Card.Content>
      </Card>

      {/* Liste des articles */}
      <Card style={styles.itemsCard}>
        <Card.Content>
          <Title>Articles de cette source ({items.length})</Title>
          {items.length === 0 ? (
            <Text style={styles.emptyText}>Aucun article de cette source</Text>
          ) : (
            <View style={styles.itemsList}>
              {items.slice(0, 10).map((item) => (
                <List.Item
                  key={item.id}
                  title={item.name}
                  description={`${item.purchasePrice}€ → ${item.sellingPrice}€`}
                  left={() => (
                    <Chip 
                      mode="outlined" 
                      compact
                      style={[
                        styles.statusChip,
                        item.status === 'sold' 
                          ? { backgroundColor: activeTheme.primaryContainer }
                          : { backgroundColor: activeTheme.secondaryContainer }
                      ]}
                    >
                      {item.status === 'sold' ? 'Vendu' : 'Disponible'}
                    </Chip>
                  )}
                  right={() => (
                    <IconButton
                      icon="chevron-right"
                      size={20}
                      onPress={() => handleItemPress(item.id)}
                    />
                  )}
                  onPress={() => handleItemPress(item.id)}
                />
              ))}
              {items.length > 10 && (
                <Text style={styles.moreItemsText}>
                  et {items.length - 10} article(s) de plus...
                </Text>
              )}
            </View>
          )}
        </Card.Content>
      </Card>
      </ScrollView>
    </View>
  );
}

