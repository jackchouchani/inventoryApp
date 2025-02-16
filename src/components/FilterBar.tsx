import React, { useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Text, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { selectAllCategories } from '../store/categorySlice';
import { selectAllContainers } from '../store/containersSlice';

interface FilterBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onCategoryChange?: (categoryId: number | undefined) => void;
  onContainerChange?: (containerId: number | 'none' | undefined) => void;
  onStatusChange?: (status: 'all' | 'available' | 'sold') => void;
  onPriceChange?: (min: number | undefined, max: number | undefined) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  value,
  onChangeText,
  placeholder,
  onCategoryChange,
  onContainerChange,
  onStatusChange,
  onPriceChange
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const [selectedContainer, setSelectedContainer] = useState<number | 'none' | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'available' | 'sold'>('all');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const categories = useSelector(selectAllCategories);
  const containers = useSelector(selectAllContainers);

  const handleCategorySelect = (categoryId: number) => {
    const newValue = selectedCategory === categoryId ? undefined : categoryId;
    setSelectedCategory(newValue);
    onCategoryChange?.(newValue);
  };

  const handleContainerSelect = (containerId: number) => {
    const newValue = selectedContainer === containerId ? undefined : containerId;
    setSelectedContainer(newValue);
    onContainerChange?.(newValue);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={24} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#999"
        />
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterChips}>
                {categories.map((category) => (
                  <TouchableOpacity 
                    key={category.id} 
                    style={[styles.filterChip, selectedCategory === category.id && styles.filterChipSelected]}
                    onPress={() => handleCategorySelect(category.id)}
                  >
                    <MaterialIcons 
                      name={category.icon || 'folder'} 
                      size={16} 
                      color={selectedCategory === category.id ? '#fff' : '#666'} 
                    />
                    <Text style={[
                      styles.filterChipText,
                      selectedCategory === category.id && styles.filterChipTextSelected
                    ]}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>Containers</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterChips}>
                {containers.map((container) => (
                  <TouchableOpacity 
                    key={container.id} 
                    style={[styles.filterChip, selectedContainer === container.id && styles.filterChipSelected]}
                    onPress={() => handleContainerSelect(container.id)}
                  >
                    <MaterialIcons 
                      name="inbox" 
                      size={16} 
                      color={selectedContainer === container.id ? '#fff' : '#666'} 
                    />
                    <Text style={[
                      styles.filterChipText,
                      selectedContainer === container.id && styles.filterChipTextSelected
                    ]}>
                      {container.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>Statut</Text>
            <View style={styles.filterChips}>
              {[
                { value: 'all', label: 'Tous' },
                { value: 'available', label: 'En stock' },
                { value: 'sold', label: 'Rupture' }
              ].map((status) => (
                <TouchableOpacity
                  key={status.value}
                  style={[styles.filterChip, selectedStatus === status.value && styles.filterChipSelected]}
                  onPress={() => {
                    setSelectedStatus(status.value as 'all' | 'available' | 'sold');
                    onStatusChange?.(status.value as 'all' | 'available' | 'sold');
                  }}
                >
                  <MaterialIcons
                    name={status.value === 'available' ? 'check-circle' : status.value === 'sold' ? 'remove-circle' : 'all-inclusive'}
                    size={16}
                    color={selectedStatus === status.value ? '#fff' : '#666'}
                  />
                  <Text style={[
                    styles.filterChipText,
                    selectedStatus === status.value && styles.filterChipTextSelected
                  ]}>
                    {status.label}
                  </Text>
                </TouchableOpacity>
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
                onChangeText={(text) => {
                  setMinPrice(text);
                  const min = text ? parseFloat(text) : undefined;
                  const max = maxPrice ? parseFloat(maxPrice) : undefined;
                  onPriceChange?.(min, max);
                }}
                keyboardType="numeric"
              />
              <Text style={styles.priceSeparator}>-</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="Max"
                value={maxPrice}
                onChangeText={(text) => {
                  setMaxPrice(text);
                  const min = minPrice ? parseFloat(minPrice) : undefined;
                  const max = text ? parseFloat(text) : undefined;
                  onPriceChange?.(min, max);
                }}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingLeft: 40,
    fontSize: 16,
    color: '#333',
  },
  filterButton: {
    marginLeft: 12,
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  filtersContainer: {
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  filterSection: {
    marginBottom: 16,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    marginLeft: 4,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  filterChipSelected: {
    backgroundColor: '#007AFF',
  },
  filterChipText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  filterChipTextSelected: {
    color: '#fff',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  priceSeparator: {
    fontSize: 16,
    color: '#666',
  },
}); 