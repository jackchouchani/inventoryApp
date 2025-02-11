import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, SafeAreaView, TextInput, ScrollView, Platform } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useInventoryData } from '../../src/hooks/useInventoryData';
import { LabelGenerator } from '../../src/components/LabelGenerator';
import { FilterBar } from '../../src/components/FilterBar';
import { handleDatabaseError } from '../../src/utils/errorHandler';
import { Item, Container, Category } from '../../src/database/types';
import { generateQRValue, QRCodeType } from '../../src/utils/qrCodeManager';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Filters {
  search: string;
  categoryId: number | null;
  containerId: number | null;
  minPrice: string;
  maxPrice: string;
  startDate: Date | null;
  endDate: Date | null;
  status: 'all' | 'available' | 'sold';
}

export default function LabelScreen() {
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [selectedContainers, setSelectedContainers] = useState<number[]>([]);
  const [showContainers, setShowContainers] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    categoryId: null,
    containerId: null,
    minPrice: '',
    maxPrice: '',
    startDate: null,
    endDate: null,
    status: 'all'
  });

  const { data: inventoryData, isLoading, error } = useInventoryData();

  // Effet pour mettre à jour les containers sélectionnés quand on bascule en mode container
  useEffect(() => {
    if (showContainers && inventoryData?.containers) {
      setSelectedContainers(inventoryData.containers.map(container => container.id!));
    }
  }, [showContainers, inventoryData?.containers]);

  useEffect(() => {
    if (inventoryData?.items) {
      const filteredIds = inventoryData.items
        .filter((item: Item) => {
          const matchesSearch = !filters.search || item.name.toLowerCase().includes(filters.search.toLowerCase());
          const matchesCategory = !filters.categoryId || item.categoryId === filters.categoryId;
          const matchesContainer = !filters.containerId || item.containerId === filters.containerId;
          
          const minPrice = parseFloat(filters.minPrice);
          const maxPrice = parseFloat(filters.maxPrice);
          const matchesPrice = 
            (!minPrice || item.sellingPrice >= minPrice) &&
            (!maxPrice || item.sellingPrice <= maxPrice);

          const itemDate = item.createdAt ? new Date(item.createdAt) : null;
          const matchesDate = 
            (!filters.startDate || !itemDate || itemDate >= filters.startDate) &&
            (!filters.endDate || !itemDate || itemDate <= filters.endDate);

          const matchesStatus = filters.status === 'all' || item.status === filters.status;

          return matchesSearch && matchesCategory && matchesContainer && 
                 matchesPrice && matchesDate && matchesStatus;
        })
        .map(item => item.id!);
      setSelectedItems(filteredIds);
    }
  }, [filters, inventoryData?.items]);

  const onDateChange = (event: any, selectedDate: Date | undefined, isStartDate: boolean) => {
    if (Platform.OS === 'android') {
      setShowStartDatePicker(false);
      setShowEndDatePicker(false);
    }

    if (selectedDate) {
      setFilters(prev => ({
        ...prev,
        [isStartDate ? 'startDate' : 'endDate']: selectedDate
      }));
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Chargement des données...</Text>
      </View>
    );
  }

  if (error) {
    handleDatabaseError(error, 'LabelScreen');
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          Une erreur est survenue lors du chargement des données
        </Text>
      </View>
    );
  }

  const getItemsToGenerate = () => {
    if (showContainers) {
      return (inventoryData?.containers || [])
        .filter(container => selectedContainers.includes(container.id!))
        .map(container => ({
          id: container.id!,
          name: container.name,
          description: container.description,
          number: container.number.toString(),
          qrCode: container.qrCode || generateQRValue('CONTAINER')
        }));
    } else {
      return (inventoryData?.items || [])
        .filter(item => selectedItems.includes(item.id!))
        .map(item => ({
          id: item.id!,
          name: item.name,
          description: item.description,
          sellingPrice: item.sellingPrice,
          qrCode: item.qrCode || generateQRValue('ITEM')
        }));
    }
  };

  const renderDatePicker = (isStartDate: boolean) => {
    if (Platform.OS === 'web') {
      return (
        <input
          type="date"
          style={{
            opacity: 0,
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            cursor: 'pointer'
          }}
          onClick={(e) => e.currentTarget.showPicker()}
          onChange={(e) => {
            const date = e.target.value ? new Date(e.target.value) : undefined;
            onDateChange(null, date, isStartDate);
          }}
        />
      );
    }

    return (
      (isStartDate ? showStartDatePicker : showEndDatePicker) && (
        <DateTimePicker
          value={isStartDate ? filters.startDate || new Date() : filters.endDate || new Date()}
          mode="date"
          onChange={(event, date) => onDateChange(event, date, isStartDate)}
        />
      )
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Génération d'étiquettes</Text>
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, !showContainers && styles.filterButtonActive]}
            onPress={() => setShowContainers(false)}
          >
            <Text style={[styles.filterButtonText, !showContainers && styles.filterButtonTextActive]}>
              Articles
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, showContainers && styles.filterButtonActive]}
            onPress={() => setShowContainers(true)}
          >
            <Text style={[styles.filterButtonText, showContainers && styles.filterButtonTextActive]}>
              Containers
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {!showContainers && (
        <View style={styles.filtersSection}>
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher..."
              value={filters.search}
              onChangeText={(text) => setFilters({ ...filters, search: text })}
            />
            <TouchableOpacity
              style={[styles.filterButton, showFilters && styles.filterButtonActive]}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Text style={[styles.filterButtonText, showFilters && styles.filterButtonTextActive]}>
                Filtres {showFilters ? '✕' : '▼'}
              </Text>
            </TouchableOpacity>
          </View>

          {showFilters && (
            <ScrollView style={styles.filtersContainer}>
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Catégorie</Text>
                <View style={styles.filterOptions}>
                  {inventoryData?.categories.map((category: Category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.filterOption,
                        filters.categoryId === category.id && styles.filterOptionSelected,
                      ]}
                      onPress={() =>
                        setFilters({
                          ...filters,
                          categoryId: filters.categoryId === category.id ? null : category.id ?? null,
                        })
                      }
                    >
                      <Text>{category.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Container</Text>
                <View style={styles.filterOptions}>
                  {inventoryData?.containers.map((container) => (
                    <TouchableOpacity
                      key={container.id}
                      style={[
                        styles.filterOption,
                        filters.containerId === container.id && styles.filterOptionSelected,
                      ]}
                      onPress={() =>
                        setFilters({
                          ...filters,
                          containerId: filters.containerId === container.id ? null : container.id ?? null,
                        })
                      }
                    >
                      <Text>{container.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Disponibilité</Text>
                <View style={styles.filterOptions}>
                  {['all', 'available', 'sold'].map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.filterOption,
                        filters.status === status && styles.filterOptionSelected,
                      ]}
                      onPress={() => setFilters({ 
                        ...filters, 
                        status: status as Filters['status'] 
                      })}
                    >
                      <Text>{
                        status === 'all' ? 'Tous' :
                        status === 'available' ? 'Disponible' : 'Vendu'
                      }</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Date de création</Text>
                <View style={styles.dateInputs}>
                  <TouchableOpacity style={styles.dateInput}>
                    <Text style={styles.dateInputText}>
                      {filters.startDate 
                        ? filters.startDate.toLocaleDateString() 
                        : 'Date début'}
                    </Text>
                    {renderDatePicker(true)}
                  </TouchableOpacity>
                  <Text>-</Text>
                  <TouchableOpacity style={styles.dateInput}>
                    <Text style={styles.dateInputText}>
                      {filters.endDate 
                        ? filters.endDate.toLocaleDateString() 
                        : 'Date fin'}
                    </Text>
                    {renderDatePicker(false)}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Fourchette de prix</Text>
                <View style={styles.priceInputs}>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="Min"
                    value={filters.minPrice}
                    onChangeText={(text) => setFilters({ ...filters, minPrice: text })}
                    keyboardType="numeric"
                  />
                  <Text>-</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="Max"
                    value={filters.maxPrice}
                    onChangeText={(text) => setFilters({ ...filters, maxPrice: text })}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      )}

      <View style={styles.content}>
        <LabelGenerator
          items={getItemsToGenerate()}
          mode={showContainers ? 'containers' : 'items'}
          onComplete={() => {
            setFilters({
              search: '',
              categoryId: null,
              containerId: null,
              minPrice: '',
              maxPrice: '',
              startDate: null,
              endDate: null,
              status: 'all'
            });
          }}
          onError={(error: Error) => {
            handleDatabaseError(error, 'LabelScreen.generation');
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#FF3B30',
    textAlign: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 10,
  },
  filterButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    color: '#007AFF',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  filtersSection: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchBar: {
    flexDirection: 'row',
    padding: 10,
    gap: 10,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  filtersContainer: {
    maxHeight: 300,
    padding: 10,
  },
  filterSection: {
    marginBottom: 15,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
  },
  filterOptionSelected: {
    backgroundColor: '#007AFF',
  },
  dateInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  dateInputText: {
    color: '#333',
    fontSize: 13,
  },
  priceInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceInput: {
    width: 100,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    marginHorizontal: 5,
  },
}); 