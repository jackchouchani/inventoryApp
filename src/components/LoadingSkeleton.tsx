import React, { memo, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from './Skeleton';
import { useAppTheme, AppThemeType } from '../contexts/ThemeContext';

export const LoadingSkeleton = memo(() => {
  const { activeTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(activeTheme), [activeTheme]);

  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: 5 }).map((_, index) => (
        <View key={index} style={styles.skeletonRow}>
          <View style={styles.skeletonContent}>
            <Skeleton style={styles.skeletonImage} />
            <View style={styles.skeletonDetails}>
              <Skeleton style={styles.skeletonName} />
              <Skeleton style={styles.skeletonPrice} />
              <Skeleton style={styles.skeletonCategory} />
              <Skeleton style={styles.skeletonStatus} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
});

const createStyles = (theme: AppThemeType) => StyleSheet.create({
  skeletonContainer: {
    flex: 1,
    backgroundColor: theme.background,
    paddingTop: 12,
  },
  skeletonRow: {
    backgroundColor: theme.card,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    padding: 16,
    ...theme.shadows.small,
  },
  skeletonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skeletonImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  skeletonDetails: {
    flex: 1,
  },
  skeletonName: {
    height: 20,
    width: '60%',
    marginBottom: 8,
    borderRadius: 4,
  },
  skeletonPrice: {
    height: 16,
    width: '30%',
    marginBottom: 8,
    borderRadius: 4,
  },
  skeletonCategory: {
    height: 14,
    width: '40%',
    marginBottom: 8,
    borderRadius: 4,
  },
  skeletonStatus: {
    height: 24,
    width: '25%',
    borderRadius: 12,
  },
}); 