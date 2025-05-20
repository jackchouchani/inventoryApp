import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';

interface PeriodSelectorProps {
  selectedPeriod: 'week' | 'month' | 'year';
  onSelectPeriod: (period: 'week' | 'month' | 'year') => void;
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  selectedPeriod,
  onSelectPeriod,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.periodButton,
          selectedPeriod === 'week' && styles.periodButtonActive,
        ]}
        onPress={() => onSelectPeriod('week')}
      >
        <Text
          style={[
            styles.periodButtonText,
            selectedPeriod === 'week' && styles.periodButtonTextActive,
          ]}
        >
          Semaine
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.periodButton,
          selectedPeriod === 'month' && styles.periodButtonActive,
        ]}
        onPress={() => onSelectPeriod('month')}
      >
        <Text
          style={[
            styles.periodButtonText,
            selectedPeriod === 'month' && styles.periodButtonTextActive,
          ]}
        >
          Mois
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.periodButton,
          selectedPeriod === 'year' && styles.periodButtonActive,
        ]}
        onPress={() => onSelectPeriod('year')}
      >
        <Text
          style={[
            styles.periodButtonText,
            selectedPeriod === 'year' && styles.periodButtonTextActive,
          ]}
        >
          Année
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 4,
    width: '100%', // Take up full width
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10, // Slightly taller buttons
    alignItems: 'center',
    borderRadius: 6,
    justifyContent: 'center', // Center content vertically
  },
  periodButtonActive: {
    backgroundColor: '#007AFF',
  },
  periodButtonText: {
    fontSize: 15, // Larger text
    color: '#666',
    fontWeight: '500',
  },
  periodButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default PeriodSelector; 