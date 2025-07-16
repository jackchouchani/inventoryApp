import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '../src/contexts/ThemeContext';

export default function Index() {
  const { activeTheme } = useAppTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: activeTheme.background,
    },
    redirectText: {
      fontSize: 16,
      color: activeTheme.text.secondary,
      marginBottom: 20,
      textAlign: 'center',
    }
  });

  return (
    <View style={styles.container}>
      <Text style={styles.redirectText}>Chargement de l'application...</Text>
      <ActivityIndicator size="large" color={activeTheme.primary} />
    </View>
  );
}
