import { StyleSheet } from 'react-native';
import { theme } from '../utils/theme';

export const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.secondary,
    fontWeight: '400',
  },
  errorText: {
    fontSize: theme.typography.h2.fontSize,
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
    fontWeight: '500',
  },
  errorDetail: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    fontWeight: '400',
  },
}); 