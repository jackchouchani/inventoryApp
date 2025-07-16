import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { useAppTheme, ThemeMode } from '../contexts/ThemeContext';
import { Icon } from './Icon'; // Assurez-vous que le chemin d'importation est correct

const ThemeToggle = () => {
  const { themeMode, setThemeMode, activeTheme } = useAppTheme();
  const systemTheme = useColorScheme();

  const options: { mode: ThemeMode; label: string; icon: string }[] = [
    { mode: 'light', label: 'Clair', icon: 'light_mode' },
    { mode: 'dark', label: 'Sombre', icon: 'dark_mode' },
    { mode: 'system', label: 'Système', icon: 'brightness_auto' },
  ];

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      backgroundColor: activeTheme.backgroundSecondary,
      borderRadius: activeTheme.borderRadius.lg,
      padding: 4,
      marginVertical: 16,
      width: '100%',
      maxWidth: 500,
      alignSelf: 'center',
    },
    option: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: activeTheme.borderRadius.md,
      marginHorizontal: 2,
    },
    activeOption: {
      backgroundColor: activeTheme.primary,
      shadowColor: activeTheme.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    optionText: {
      ...activeTheme.typography.body,
      color: activeTheme.text.secondary,
      marginLeft: 8,
      fontWeight: '600',
    },
    activeOptionText: {
      color: activeTheme.text.onPrimary,
    },
  });

  return (
    <View style={styles.container}>
      {options.map(({ mode, label, icon }) => {
        const isActive = themeMode === mode;
        return (
          <TouchableOpacity
            key={mode}
            style={[styles.option, isActive && styles.activeOption]}
            onPress={() => setThemeMode(mode)}
          >
            <Icon 
              name={icon} 
              size={20} 
              color={isActive ? activeTheme.text.onPrimary : activeTheme.text.secondary} 
            />
            <Text style={[styles.optionText, isActive && styles.activeOptionText]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default ThemeToggle;
