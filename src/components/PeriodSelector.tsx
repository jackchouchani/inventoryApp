import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';

interface PeriodSelectorProps {
  selectedPeriod: 'week' | 'month' | 'year';
  onSelectPeriod: (period: 'week' | 'month' | 'year') => void;
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  selectedPeriod,
  onSelectPeriod,
}) => {
  const { activeTheme } = useAppTheme();
  const styles = getThemedStyles(activeTheme);

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

const getThemedStyles = (theme: any) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: theme.surface,
    borderRadius: 8,
    padding: 4,
    width: '100%',
    borderWidth: 1,
    borderColor: theme.border,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
    justifyContent: 'center',
  },
  periodButtonActive: {
    backgroundColor: theme.primary,
  },
  periodButtonText: {
    fontSize: 15,
    color: theme.text.secondary,
    fontWeight: '500',
  },
  periodButtonTextActive: {
    color: theme.text.onPrimary,
    fontWeight: '600',
  },
});

export default PeriodSelector; 