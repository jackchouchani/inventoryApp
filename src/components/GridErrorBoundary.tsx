import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ErrorBoundary } from './ErrorBoundary';
import { useAppTheme } from '../contexts/ThemeContext';

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
  const { activeTheme } = useAppTheme();

  return (
    <View 
      style={[styles.container, { 
        backgroundColor: activeTheme.surface,
        padding: activeTheme.spacing.lg,
        borderRadius: activeTheme.borderRadius.md,
        margin: activeTheme.spacing.md,
      }]}
      accessibilityRole="alert"
    >
      <Text 
        style={[styles.title, { 
          color: activeTheme.text.primary,
          fontSize: activeTheme.typography.h2.fontSize,
          marginBottom: activeTheme.spacing.sm,
        }]}
        accessibilityRole="header"
      >
        Erreur de chargement de la {gridName}
      </Text>
      <Text 
        style={[styles.message, { 
          color: activeTheme.text.secondary,
          fontSize: activeTheme.typography.body.fontSize,
          marginBottom: activeTheme.spacing.lg,
        }]}
        accessibilityRole="text"
      >
        {error?.message || `Impossible d'afficher les éléments de la ${gridName}`}
      </Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.retryButton, { 
            backgroundColor: activeTheme.primary,
            paddingHorizontal: activeTheme.spacing.lg,
            paddingVertical: activeTheme.spacing.md,
            borderRadius: activeTheme.borderRadius.sm,
          }]}
          onPress={resetErrorBoundary}
          accessibilityRole="button"
          accessibilityLabel="Réessayer"
          accessibilityHint="Appuyez pour recharger la grille"
        >
          <Text style={[styles.buttonText, { 
            color: activeTheme.text.onPrimary,
            fontSize: activeTheme.typography.body.fontSize,
          }]}>
            Réessayer
          </Text>
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
    alignItems: 'center',
  },
  title: {
    fontWeight: 'bold',
  },
  message: {
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  retryButton: {
    elevation: 2,
  },
  buttonText: {
    fontWeight: '600',
  },
}); 