import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { CATEGORY_ICONS } from '../constants/categoryIcons';

interface IconSelectorProps {
  selectedIcon?: string;
  onSelectIcon: (icon: string) => void;
}

export const IconSelector: React.FC<IconSelectorProps> = ({
  selectedIcon,
  onSelectIcon,
}) => {
  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {CATEGORY_ICONS.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[
            styles.iconButton,
            selectedIcon === item.icon && styles.selectedIconButton,
          ]}
          onPress={() => onSelectIcon(item.icon)}
        >
          <MaterialIcons
            name={item.icon}
            size={24}
            color={selectedIcon === item.icon ? '#fff' : '#333'}
          />
          <Text 
            style={[
              styles.iconLabel,
              selectedIcon === item.icon && styles.selectedIconLabel,
            ]}
            numberOfLines={1}
          >
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    minWidth: 80,
  },
  selectedIconButton: {
    backgroundColor: '#007AFF',
  },
  iconLabel: {
    fontSize: 12,
    marginTop: 4,
    color: '#333',
    textAlign: 'center',
  },
  selectedIconLabel: {
    color: '#fff',
  },
}); 