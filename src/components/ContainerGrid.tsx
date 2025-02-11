import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Container, Item } from '../database/types';

interface ContainerGridProps {
  containers: Container[];
  items: Item[];
  onContainerPress: (containerId: number) => void;
}

export const ContainerGrid: React.FC<ContainerGridProps> = ({
  containers,
  items,
  onContainerPress,
}) => {
  const getItemCount = (containerId: number) => {
    return items.filter(item => item.containerId === containerId).length;
  };

  const renderItem = ({ item: container }: { item: Container }) => {
    const itemCount = getItemCount(container.id!);
    
    return (
      <TouchableOpacity
        style={styles.containerCard}
        onPress={() => container.id && onContainerPress(container.id)}
      >
        <Text style={styles.containerName} numberOfLines={2}>
          {container.name}
        </Text>
        <Text style={styles.containerNumber}>#{container.number}</Text>
        <View style={styles.statsContainer}>
          <Text style={styles.itemCount}>
            {itemCount} article{itemCount > 1 ? 's' : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={containers}
      renderItem={renderItem}
      keyExtractor={(item) => `container-${item.id}`}
      numColumns={2}
      contentContainerStyle={styles.grid}
      columnWrapperStyle={styles.row}
    />
  );
};

const { width } = Dimensions.get('window');
const CARD_MARGIN = 8;
const CARD_WIDTH = (width - (CARD_MARGIN * 6)) / 2;

const styles = StyleSheet.create({
  grid: {
    padding: CARD_MARGIN,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: CARD_MARGIN,
  },
  containerCard: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: CARD_MARGIN,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  containerName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  containerNumber: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCount: {
    fontSize: 14,
    color: '#007AFF',
  },
});