import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { ErrorBoundary } from './ErrorBoundary';

interface Props {
  children: React.ReactNode;
  onRetry?: () => void;
  gridName?: string;
}

export class GridErrorBoundary extends ErrorBoundary {
  declare props: Props;
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.withScope((scope) => {
      scope.setTag('component_type', 'grid');
      scope.setTag('grid_name', this.props.gridName || 'grille');
      scope.setExtra('errorInfo', errorInfo);
      Sentry.captureException(error);
    });
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>
            Erreur de chargement de la {this.props.gridName || 'grille'}
          </Text>
          <Text style={styles.message}>
            {this.state.error?.message || `Impossible d'afficher les éléments de la ${this.props.gridName || 'grille'}`}
          </Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.retryButton}
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
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    margin: 10,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#343a40',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    color: '#6c757d',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
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