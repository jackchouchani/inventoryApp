import React, { memo, useCallback, useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, ScrollView, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FilterBarProps } from '../types/props';
import { theme } from '../utils/theme';

// Composant FilterChip mémorisé pour éviter les re-rendus inutiles
const FilterChip: React.FC<{
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  selected: boolean;
  onPress: () => void;
}> = memo(({ icon, label, selected, onPress }) => {
  return (
    <TouchableOpacity 
      style={[
        styles.filterChip, 
        selected ? styles.filterChipSelected : null
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Filtre ${label}`}
    >
      <MaterialIcons 
        name={icon}
        size={18} 
        color={selected ? theme.colors.text.inverse : theme.colors.text.secondary} 
      />
      <Text style={[
        styles.filterChipText, 
        selected ? styles.filterChipTextSelected : null
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Optimisation supplémentaire pour FilterChip
  return prevProps.selected === nextProps.selected && 
         prevProps.label === nextProps.label &&
         prevProps.icon === nextProps.icon;
});

// Composant FilterBar mémorisé pour éviter les re-rendus inutiles
const FilterBarComponent = function FilterBar({
  value,
  onChangeText,
  placeholder = "Rechercher...",
  onCategoryChange,
  onContainerChange,
  onStatusChange,
  onPriceChange,
  categories = [],
  containers = [],
  selectedCategoryId,
  selectedContainerId,
  selectedStatus = 'all',
  minPrice = '',
  maxPrice = ''
}: FilterBarProps) {
  // État local uniquement pour l'affichage des filtres
  const [showFilters, setShowFilters] = useState(false);
  
  // Gestionnaires d'événements avec useCallback pour éviter les recréations inutiles
  const handleCategorySelect = useCallback((categoryId: number) => {
    if (onCategoryChange) {
      onCategoryChange(selectedCategoryId === categoryId ? undefined : categoryId);
    }
  }, [selectedCategoryId, onCategoryChange]);
  
  const handleContainerSelect = useCallback((containerId: number) => {
    if (onContainerChange) {
      onContainerChange(selectedContainerId === containerId ? undefined : containerId);
    }
  }, [selectedContainerId, onContainerChange]);
  
  const handleStatusChange = useCallback((status: 'all' | 'available' | 'sold') => {
    if (onStatusChange) {
      onStatusChange(status);
    }
  }, [onStatusChange, selectedStatus]);
  
  const handleMinPriceChange = useCallback((text: string) => {
    if (onPriceChange) {
      onPriceChange(
        text ? Number(text) : undefined,
        maxPrice ? Number(maxPrice) : undefined
      );
    }
  }, [maxPrice, onPriceChange, minPrice]);
  
  const handleMaxPriceChange = useCallback((text: string) => {
    if (onPriceChange) {
      onPriceChange(
        minPrice ? Number(minPrice) : undefined,
        text ? Number(text) : undefined
      );
    }
  }, [minPrice, onPriceChange, maxPrice]);

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <MaterialIcons 
          name="search" 
          size={24} 
          color={theme.colors.text.secondary} 
          style={styles.searchIcon} 
        />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#999"
          accessibilityLabel="Barre de recherche"
          accessibilityHint="Entrez votre terme de recherche"
        />
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showFilters }}
          accessibilityLabel="Afficher les filtres"
        >
          <MaterialIcons 
            name={showFilters ? "filter-list-off" : "filter-list"} 
            size={24} 
            color={theme.colors.text.secondary} 
          />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filtersContainer}>
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>Catégories</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              accessibilityRole="scrollbar"
              accessibilityLabel="Liste des catégories"
            >
              <View style={styles.filterChips}>
                {categories.map((category) => (
                  <FilterChip
                    key={category.id}
                    icon={category.icon as keyof typeof MaterialIcons.glyphMap || 'folder'}
                    label={category.name}
                    selected={category.id === selectedCategoryId}
                    onPress={() => handleCategorySelect(category.id)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>Containers</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              accessibilityRole="scrollbar"
              accessibilityLabel="Liste des containers"
            >
              <View style={styles.filterChips}>
                {containers.map((container) => (
                  <FilterChip
                    key={container.id}
                    icon="inbox"
                    label={container.name}
                    selected={container.id === selectedContainerId}
                    onPress={() => handleContainerSelect(container.id)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>Statut</Text>
            <View style={styles.filterChips}>
              {[
                { value: 'all' as const, label: 'Tous', icon: 'all-inclusive' },
                { value: 'available' as const, label: 'En stock', icon: 'check-circle' },
                { value: 'sold' as const, label: 'Rupture', icon: 'remove-circle' }
              ].map((status) => (
                <FilterChip
                  key={status.value}
                  icon={status.icon as keyof typeof MaterialIcons.glyphMap}
                  label={status.label}
                  selected={selectedStatus === status.value}
                  onPress={() => handleStatusChange(status.value)}
                />
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>Prix</Text>
            <View style={styles.priceContainer}>
              <TextInput
                style={styles.priceInput}
                placeholder="Min"
                value={minPrice.toString()}
                onChangeText={handleMinPriceChange}
                keyboardType="numeric"
                accessibilityLabel="Prix minimum"
                accessibilityHint="Entrez le prix minimum"
              />
              <Text style={styles.priceSeparator}>-</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="Max"
                value={maxPrice.toString()}
                onChangeText={handleMaxPriceChange}
                keyboardType="numeric"
                accessibilityLabel="Prix maximum"
                accessibilityHint="Entrez le prix maximum"
              />
            </View>
          </View>

          <TouchableOpacity 
            style={styles.resetButton}
            onPress={() => {
              if (onCategoryChange) onCategoryChange(undefined);
              if (onContainerChange) onContainerChange(undefined);
              if (onStatusChange) onStatusChange('all');
              if (onPriceChange) onPriceChange(undefined, undefined);
              if (onChangeText) onChangeText('');
            }}
          >
            <Text style={styles.resetButtonText}>
              Réinitialiser les filtres
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// Utiliser React.memo avec une fonction de comparaison personnalisée
export const FilterBar = memo(FilterBarComponent, (prevProps, nextProps) => {
  // Comparer les props importantes pour éviter les re-rendus inutiles
  return prevProps.value === nextProps.value &&
         prevProps.selectedCategoryId === nextProps.selectedCategoryId &&
         prevProps.selectedContainerId === nextProps.selectedContainerId &&
         prevProps.selectedStatus === nextProps.selectedStatus &&
         prevProps.minPrice === nextProps.minPrice &&
         prevProps.maxPrice === nextProps.maxPrice &&
         prevProps.categories === nextProps.categories &&
         prevProps.containers === nextProps.containers &&
         prevProps.onChangeText === nextProps.onChangeText &&
         prevProps.onCategoryChange === nextProps.onCategoryChange &&
         prevProps.onContainerChange === nextProps.onContainerChange &&
         prevProps.onStatusChange === nextProps.onStatusChange &&
         prevProps.onPriceChange === nextProps.onPriceChange;
});

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  filterButton: {
    padding: theme.spacing.sm,
    marginLeft: theme.spacing.sm,
  },
  filtersContainer: {
    marginTop: theme.spacing.sm,
  },
  filterSection: {
    marginBottom: theme.spacing.md,
  },
  filterTitle: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
    color: theme.colors.text.primary,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    marginRight: theme.spacing.sm,
  },
  filterChipSelected: {
    backgroundColor: theme.colors.primary,
  },
  filterChipText: {
    marginLeft: theme.spacing.xs,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.caption.fontSize,
  },
  filterChipTextSelected: {
    color: theme.colors.text.inverse,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceInput: {
    width: 100,
    height: 40,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  priceSeparator: {
    marginHorizontal: theme.spacing.sm,
    color: theme.colors.text.secondary,
  },
  resetButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  resetButtonText: {
    color: theme.colors.text.inverse,
    fontWeight: 'bold',
  },
}); 