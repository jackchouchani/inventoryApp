import React, { useCallback, useMemo } from 'react';
import { Text, StyleSheet, TouchableOpacity, ScrollView, useColorScheme } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CATEGORY_ICONS } from '../constants/categoryIcons';
import { MaterialIconName } from '../types/icons';
import { theme } from '../utils/theme';

interface IconSelectorProps {
  selectedIcon?: MaterialIconName;
  onSelectIcon: (icon: MaterialIconName) => void;
  testID?: string;
}

export const IconSelector: React.FC<IconSelectorProps> = React.memo(({
  selectedIcon,
  onSelectIcon,
  testID = 'icon-selector',
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const styles = useMemo(() => createStyles(isDark), [isDark]);

  const handleSelectIcon = useCallback((icon: MaterialIconName) => {
    Haptics.selectionAsync();
    onSelectIcon(icon);
  }, [onSelectIcon]);

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      testID={testID}
    >
      {CATEGORY_ICONS.map((item) => {
        const isSelected = selectedIcon === item.icon;
        return (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.iconButton,
              isSelected && styles.selectedIconButton,
            ]}
            onPress={() => handleSelectIcon(item.icon)}
            accessibilityRole="button"
            accessibilityLabel={`Sélectionner l'icône ${item.label}`}
            accessibilityState={{ selected: isSelected }}
            testID={`${testID}-item-${item.id}`}
          >
            <MaterialIcons
              name={item.icon}
              size={24}
              color={isSelected ? theme.colors.text.inverse : theme.colors.text.primary}
            />
            <Text 
              style={[
                styles.iconLabel,
                isSelected && styles.selectedIconLabel,
              ]}
              numberOfLines={1}
              accessibilityRole="text"
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

IconSelector.displayName = 'IconSelector';

const createStyles = (isDark: boolean) => StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: isDark ? theme.colors.surface : theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    minWidth: 80,
  },
  selectedIconButton: {
    backgroundColor: theme.colors.primary,
  },
  iconLabel: {
    fontSize: theme.typography.caption.fontSize,
    marginTop: theme.spacing.xs,
    color: isDark ? theme.colors.text.inverse : theme.colors.text.primary,
    textAlign: 'center',
  },
  selectedIconLabel: {
    color: theme.colors.text.inverse,
  },
}); 