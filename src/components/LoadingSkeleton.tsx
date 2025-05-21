import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from './Skeleton';

export const LoadingSkeleton = memo(() => (
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
));

const styles = StyleSheet.create({
  skeletonContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 12,
  },
  skeletonRow: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    boxShadow: '0px 2px 2px rgba(0, 0, 0, 0.1)',
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