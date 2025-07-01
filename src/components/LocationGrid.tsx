import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet, Dimensions } from 'react-native';
import { Location } from '../types/location';
import { GridErrorBoundary } from './GridErrorBoundary';
import { useAppTheme } from '../contexts/ThemeContext';
import { Icon } from './Icon';

interface LocationGridProps {
  locations: (Location & { containerCount?: number; itemCount?: number; totalValue?: number })[];
  onLocationPress: (locationId: number) => void;
  onDeleteLocation?: (locationId: number) => void;
  onRefresh?: () => void;
  onRetry?: () => void;
}

const { width } = Dimensions.get('window');

// Layout responsive selon la taille d'écran
const getResponsiveLayout = () => {
  let numColumns = 2; // Mobile par défaut
  let cardPadding = 12;
  let gridPadding = 16;
  
  if (width >= 1200) {
    // Desktop large
    numColumns = 4;
    cardPadding = 16;
    gridPadding = 24;
  } else if (width >= 900) {
    // Desktop/Tablet large
    numColumns = 3;
    cardPadding = 14;
    gridPadding = 20;
  } else if (width >= 600) {
    // Tablet
    numColumns = 3;
    cardPadding = 12;
    gridPadding = 16;
  }
  
  const cardMargin = 8;
  const availableWidth = width - (gridPadding * 2) - (cardMargin * (numColumns - 1));
  const cardWidth = availableWidth / numColumns;
  
  return {
    numColumns,
    cardWidth,
    cardPadding,
    gridPadding,
    cardMargin
  };
};

const LocationCard = React.memo(({ 
  location, 
  onPress,
  onDelete,
  activeTheme,
  layout
}: { 
  location: Location & { containerCount?: number; itemCount?: number; totalValue?: number };
  onPress: () => void;
  onDelete?: () => void;
  activeTheme: any;
  layout: any;
}) => {
  const styles = useMemo(() => getCardStyles(activeTheme, layout), [activeTheme, layout]);
  
  return (
    <TouchableOpacity
      style={styles.locationCard}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.locationName} numberOfLines={2}>
          {location.name}
        </Text>
        {onDelete && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Icon name="delete_outline" size={18} color={activeTheme.error} />
          </TouchableOpacity>
        )}
      </View>
      
      {location.address && (
        <Text style={styles.locationAddress} numberOfLines={2}>
          📍 {location.address}
        </Text>
      )}
      
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{location.containerCount || 0}</Text>
          <Text style={styles.statLabel}>Container(s)</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{location.itemCount || 0}</Text>
          <Text style={styles.statLabel}>Article(s)</Text>
        </View>
      </View>
      
      {location.totalValue && location.totalValue > 0 && (
        <Text style={styles.totalValue}>
          Valeur: {location.totalValue.toFixed(2)}€
        </Text>
      )}
    </TouchableOpacity>
  );
});

export const LocationGrid: React.FC<LocationGridProps> = ({
  locations,
  onLocationPress,
  onDeleteLocation,
  onRefresh,
  onRetry
}) => {
  const { activeTheme } = useAppTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Configuration responsive
  const layout = useMemo(() => getResponsiveLayout(), []);
  
  // Mise à jour du layout lors du changement d'orientation
  const [currentLayout, setCurrentLayout] = useState(layout);
  useEffect(() => {
    const updateLayout = () => {
      setCurrentLayout(getResponsiveLayout());
    };
    
    const subscription = Dimensions.addEventListener('change', updateLayout);
    return () => subscription?.remove();
  }, []);

  const styles = useMemo(() => getGridStyles(activeTheme, currentLayout), [activeTheme, currentLayout]);

  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [onRefresh]);

  const renderLocation = useCallback(({ item }: { item: typeof locations[0] }) => {
    return (
      <LocationCard
        location={item}
        onPress={() => onLocationPress(item.id)}
        onDelete={onDeleteLocation ? () => onDeleteLocation(item.id) : undefined}
        activeTheme={activeTheme}
        layout={currentLayout}
      />
    );
  }, [onLocationPress, onDeleteLocation, activeTheme, currentLayout]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Icon name="location_off" size={64} color={activeTheme.text.secondary} />
      <Text style={styles.emptyTitle}>Aucun emplacement</Text>
      <Text style={styles.emptyMessage}>
        Ajoutez votre premier emplacement pour organiser vos containers et articles.
      </Text>
    </View>
  ), [activeTheme, styles]);

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: currentLayout.cardWidth,
    offset: Math.floor(index / currentLayout.numColumns) * 140, // Hauteur estimée de carte
    index,
  }), [currentLayout]);

  return (
    <GridErrorBoundary onRetry={onRetry}>
      <View style={styles.container}>
        <FlatList
          data={locations}
          renderItem={renderLocation}
          keyExtractor={(item) => `location-${item.id}`}
          numColumns={currentLayout.numColumns}
          key={`${currentLayout.numColumns}-${width}`} // Force re-render on orientation change
          contentContainerStyle={styles.grid}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                colors={[activeTheme.primary]}
                tintColor={activeTheme.primary}
              />
            ) : undefined
          }
          showsVerticalScrollIndicator={false}
          getItemLayout={locations.length > 50 ? getItemLayout : undefined}
          removeClippedSubviews={locations.length > 50}
          maxToRenderPerBatch={20}
          windowSize={5}
          initialNumToRender={20}
        />
      </View>
    </GridErrorBoundary>
  );
};

const getGridStyles = (theme: any, layout: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  grid: {
    padding: layout.gridPadding,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    color: theme.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});

const getCardStyles = (theme: any, layout: any) => StyleSheet.create({
  locationCard: {
    width: layout.cardWidth,
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: layout.cardPadding,
    marginBottom: layout.cardMargin,
    marginRight: layout.cardMargin,
    borderWidth: 1,
    borderColor: theme.border,
    minHeight: 140,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text.primary,
    flex: 1,
    marginRight: 8,
  },
  deleteButton: {
    padding: 4,
    borderRadius: 4,
  },
  locationAddress: {
    fontSize: 12,
    color: theme.text.secondary,
    fontStyle: 'italic',
    marginBottom: 8,
    lineHeight: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.primary,
  },
  statLabel: {
    fontSize: 11,
    color: theme.text.secondary,
    marginTop: 2,
  },
  totalValue: {
    fontSize: 12,
    color: theme.text.secondary,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
});