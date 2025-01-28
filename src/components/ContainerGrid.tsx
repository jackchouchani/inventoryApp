import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Container, Item } from '../database/database';

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
    return items.filter((item) => item.containerId === containerId).length;
  };

  const renderContainer = (container: Container) => (
    <TouchableOpacity
      key={container.id}
      style={styles.containerBox}
      onPress={() => onContainerPress(container.id!)}
    >
      <Text style={styles.containerNumber}>{container.name}</Text>
      <Text style={styles.itemCount}>{getItemCount(container.id!)} items</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.grid}>
      {containers.map((container) => renderContainer(container))}
    </View>
  );
};

const { width } = Dimensions.get('window');
const GRID_PADDING = 10;
const GRID_SPACING = 8;
const CONTAINER_SIZE = (width - 2 * GRID_PADDING - 3 * GRID_SPACING) / 4;

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: GRID_PADDING,
    gap: GRID_SPACING,
  },
  containerBox: {
    width: CONTAINER_SIZE,
    height: CONTAINER_SIZE,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  containerNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  itemCount: {
    fontSize: 14,
    color: '#666',
  },
});