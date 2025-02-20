import React, { memo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, AccessibilityInfo } from 'react-native';
import { useCompressionStore } from '../services/photoService';
import { theme } from '../utils/theme';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { handleError, ErrorType } from '../utils/errorHandler';

interface CompressionProgressProps {
  testID?: string;
}

export const CompressionProgress: React.FC<CompressionProgressProps> = memo(({ testID }) => {
  const { isCompressing, progress, error } = useCompressionStore();

  React.useEffect(() => {
    if (isCompressing) {
      AccessibilityInfo.announceForAccessibility(`Compression de l'image en cours, ${Math.round(progress)}% complété`);
    }
  }, [isCompressing, progress]);

  React.useEffect(() => {
    if (error) {
      handleError(error, ErrorType.UNKNOWN, {
        context: 'CompressionProgress',
        shouldNotify: true
      });
    }
  }, [error]);

  if (!isCompressing) return null;
  if (error) return null;

  return (
    <ErrorBoundary>
      <View 
        style={styles.container}
        testID={testID}
        accessibilityRole="progressbar"
        accessibilityLabel="Progression de la compression"
        accessibilityValue={{ now: progress, min: 0, max: 100 }}
      >
        <View style={styles.content}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.text}>Compression de l'image...</Text>
          <Text style={styles.progress}>{Math.round(progress)}%</Text>
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBar, 
                { width: `${progress}%` }
              ]} 
            />
          </View>
        </View>
      </View>
    </ErrorBoundary>
  );
});

CompressionProgress.displayName = 'CompressionProgress';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  content: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    width: '80%',
    maxWidth: 300,
    ...theme.shadows.medium,
  },
  text: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  progress: {
    marginTop: theme.spacing.xs,
    fontSize: theme.typography.h2.fontSize,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.sm,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
  },
}); 