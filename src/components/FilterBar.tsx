import React, { memo, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, Text, ScrollView, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFilterBar, FilterStatus } from '../hooks/useFilterBar';
import { FilterBarProps } from '../types/props';
import { searchSchema, priceRangeSchema } from '../utils/validation';
import { handleError } from '../utils/errorHandler';
import debounce from 'lodash/debounce';
import { theme } from '../utils/theme';

const FilterChip: React.FC<{
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  selected: boolean;
  onPress: () => void;
}> = memo(({ icon, label, selected, onPress }) => (
  <TouchableOpacity 
    style={[styles.filterChip, selected && styles.filterChipSelected]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    accessibilityLabel={`Filtre ${label}`}
  >
    <MaterialIcons 
      name={icon}
      size={16} 
      color={selected ? '#fff' : '#666'} 
    />
    <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>
      {label}
    </Text>
  </TouchableOpacity>
));

export const FilterBar = memo(function FilterBar({
  value,
  onChangeText,
  placeholder = "Rechercher...",
  onCategoryChange,
  onContainerChange,
  onStatusChange,
  onPriceChange
}: FilterBarProps) {
  const {
    showFilters,
    setShowFilters,
    selectedCategory,
    selectedContainer,
    selectedStatus,
    minPrice,
    maxPrice,
    categories,
    containers,
    handleCategorySelect,
    handleContainerSelect,
    handleStatusChange,
    handlePriceChange,
  } = useFilterBar({
    onCategoryChange,
    onContainerChange,
    onStatusChange,
    onPriceChange,
  });

  const handleSearchChange = useCallback(
    debounce((text: string) => {
      try {
        const validatedSearch = searchSchema.parse(text);
        onChangeText(validatedSearch);
      } catch (error) {
        handleError(error, 'Erreur de validation', {
          source: 'FilterBar',
          message: 'Erreur lors de la validation de la recherche'
        });
      }
    }, 300),
    [onChangeText]
  );

  const handlePriceRangeChange = useCallback((min?: string, max?: string) => {
    try {
      const validatedRange = priceRangeSchema.parse({
        min: min ? Number(min) : undefined,
        max: max ? Number(max) : undefined
      });
      onPriceChange?.(validatedRange.min, validatedRange.max);
    } catch (error) {
      handleError(error, 'Erreur de validation', {
        source: 'FilterBar',
        message: 'Erreur lors de la validation du prix'
      });
    }
  }, [onPriceChange]);

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <MaterialIcons 
          name="search" 
          size={24} 
          color="#999" 
          style={styles.searchIcon} 
        />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleSearchChange}
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
            color="#007AFF" 
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
                    selected={selectedCategory === category.id}
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
                    selected={selectedContainer === container.id}
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
                value={minPrice}
                onChangeText={(text) => handlePriceRangeChange(text, maxPrice)}
                keyboardType="numeric"
                accessibilityLabel="Prix minimum"
                accessibilityHint="Entrez le prix minimum"
              />
              <Text style={styles.priceSeparator}>-</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="Max"
                value={maxPrice}
                onChangeText={(text) => handlePriceRangeChange(minPrice, text)}
                keyboardType="numeric"
                accessibilityLabel="Prix maximum"
                accessibilityHint="Entrez le prix maximum"
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.value === nextProps.value &&
    prevProps.placeholder === nextProps.placeholder
  );
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
}); 