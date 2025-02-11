import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';

interface FilterBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  value,
  onChangeText,
  placeholder
}) => {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  input: {
    height: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
  },
}); 