import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { ErrorBoundary } from './ErrorBoundary';
import { ErrorType } from '../utils/errorHandler';
import { useTheme } from '../hooks/useTheme';

interface Props {
  children: React.ReactNode;
  onRetry?: () => void;
  gridName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GridErrorBoundary extends ErrorBoundary<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    Sentry.withScope((scope) => {
      scope.setTag('component_type', 'grid');
      scope.setTag('grid_name', this.props.gridName || 'grille');
      scope.setTag('error_type', ErrorType.GRID_ERROR);
      scope.setExtra('errorInfo', errorInfo);
      scope.setExtra('error_message', error.message);
      scope.setExtra('error_stack', error.stack);
      Sentry.captureException(error);
    });
  }

  handleRestart = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      const theme = useTheme();
      return (
        <View style={[styles.container, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Erreur de chargement de la {this.props.gridName || 'grille'}
          </Text>
          <Text style={[styles.message, { color: theme.colors.text }]}>
            {this.state.error?.message || `Impossible d'afficher les éléments de la ${this.props.gridName || 'grille'}`}
          </Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
              onPress={this.handleRestart}
            >
              <Text style={styles.buttonText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 8,
    margin: 10,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
}); 