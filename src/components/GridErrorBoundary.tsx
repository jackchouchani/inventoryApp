import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ErrorBoundary } from './ErrorBoundary';
import { useTheme } from '../hooks/useTheme';
import { theme } from '../utils/theme';

interface GridErrorBoundaryProps {
  children: React.ReactNode;
  onRetry?: () => void;
  gridName?: string;
}

const GridFallback = React.memo<{ error: Error; resetErrorBoundary: () => void; gridName?: string }>(({ 
  error, 
  resetErrorBoundary,
  gridName = 'grille'
}) => {
  const { colors } = useTheme();

  return (
    <View 
      style={[styles.container, { backgroundColor: colors.card }]}
      accessibilityRole="alert"
    >
      <Text 
        style={[styles.title, { color: colors.text }]}
        accessibilityRole="header"
      >
        Erreur de chargement de la {gridName}
      </Text>
      <Text 
        style={[styles.message, { color: colors.text }]}
        accessibilityRole="text"
      >
        {error?.message || `Impossible d'afficher les éléments de la ${gridName}`}
      </Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={resetErrorBoundary}
          accessibilityRole="button"
          accessibilityLabel="Réessayer"
          accessibilityHint="Appuyez pour recharger la grille"
        >
          <Text style={styles.buttonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

GridFallback.displayName = 'GridFallback';

export const GridErrorBoundary = React.memo<GridErrorBoundaryProps>(({
  children,
  onRetry,
  gridName
}) => {
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <GridFallback error={error} resetErrorBoundary={resetErrorBoundary} gridName={gridName} />
      )}
      onReset={onRetry}
    >
      {children}
    </ErrorBoundary>
  );
});

GridErrorBoundary.displayName = 'GridErrorBoundary';

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    margin: theme.spacing.md,
    alignItems: 'center',
  },
  title: {
    fontSize: theme.typography.h2.fontSize,
    fontWeight: 'bold',
    marginBottom: theme.spacing.sm,
  },
  message: {
    fontSize: theme.typography.body.fontSize,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  retryButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    ...theme.shadows.sm,
  },
  buttonText: {
    color: theme.colors.text.inverse,
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
  },
}); 