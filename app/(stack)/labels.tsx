import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ScrollView,
  Platform,
  Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LabelGenerator } from '../../src/components/LabelGenerator';
import { FilterBar } from '../../src/components/FilterBar';
import { useInventoryData } from '../../src/hooks/useInventoryData';
import { handleDatabaseError } from '../../src/utils/errorHandler';
import type { Item } from '../../src/types/item';
import type { Container } from '../../src/types/container';
import type { Category } from '../../src/types/category';

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
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectedContainers, setSelectedContainers] = useState<Set<number>>(new Set());
  const [showContainers, setShowContainers] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);
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

  const {
    items,
    containers,
    categories,
    isLoading,
    error
  } = useInventoryData({});

  const filteredItems = useMemo(() => {
    if (!items?.length) return [];

    return items.filter((item: Item) => {
      if (!item.id) return false;

      const matchesSearch = !filters.search || 
        item.name.toLowerCase().includes(filters.search.toLowerCase());
      
      const matchesCategory = !filters.categoryId || 
        item.categoryId === filters.categoryId;
      
      const matchesContainer = !filters.containerId || 
        item.containerId === filters.containerId;
      
      const minPrice = parseFloat(filters.minPrice);
      const maxPrice = parseFloat(filters.maxPrice);
      const matchesPrice = 
        (!minPrice || item.sellingPrice >= minPrice) &&
        (!maxPrice || item.sellingPrice <= maxPrice);

      const itemDate = item.createdAt ? new Date(item.createdAt) : null;
      const matchesDate = 
        (!filters.startDate || !itemDate || itemDate >= filters.startDate) &&
        (!filters.endDate || !itemDate || itemDate <= filters.endDate);

      const matchesStatus = filters.status === 'all' || 
        item.status === filters.status;

      return matchesSearch && matchesCategory && matchesContainer && 
             matchesPrice && matchesDate && matchesStatus;
    });
  }, [items, filters]);

  const handleSelectAll = () => {
    const newSelected = new Set(filteredItems.map(item => item.id!));
    setSelectedItems(newSelected);
  };

  const handleDeselectAll = () => {
    setSelectedItems(new Set());
  };

  const handleToggleItem = (itemId: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleDateChange = (event: any, selectedDate: Date | undefined) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(null);
    }

    if (selectedDate) {
      setFilters(prev => ({
        ...prev,
        [showDatePicker === 'start' ? 'startDate' : 'endDate']: selectedDate
      }));
    }
  };

  const handleResetDate = (type: 'start' | 'end') => {
    setFilters(prev => ({
      ...prev,
      [type === 'start' ? 'startDate' : 'endDate']: null
    }));
  };

  const getItemsToGenerate = () => {
    if (showContainers) {
      return containers
        ?.filter(container => selectedContainers.has(container.id!) && container.qrCode)
        .map(container => ({
          id: container.id!,
          name: container.name,
          description: container.description,
          number: container.number?.toString() || '',
          qrCode: container.qrCode
        })) || [];
    }
    
    return filteredItems
      .filter(item => selectedItems.has(item.id!) && item.qrCode)
      .map(item => ({
        id: item.id!,
        name: item.name,
        description: item.description,
        sellingPrice: item.sellingPrice,
        qrCode: item.qrCode
      }));
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialIcons name="hourglass-empty" size={48} color="#007AFF" />
        <Text style={styles.loadingText}>Chargement des données...</Text>
      </View>
    );
  }

  if (error) {
    handleDatabaseError(error, 'LabelScreen');
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>
          Une erreur est survenue lors du chargement des données
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Générateur d'étiquettes</Text>
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[styles.modeButton, !showContainers && styles.modeButtonActive]}
            onPress={() => setShowContainers(false)}
          >
            <MaterialIcons 
              name="shopping-bag" 
              size={24} 
              color={!showContainers ? '#007AFF' : '#666'} 
            />
            <Text style={[
              styles.modeButtonText,
              !showContainers && styles.modeButtonTextActive
            ]}>
              Articles ({selectedItems.size})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, showContainers && styles.modeButtonActive]}
            onPress={() => setShowContainers(true)}
          >
            <MaterialIcons 
              name="inbox" 
              size={24} 
              color={showContainers ? '#007AFF' : '#666'} 
            />
            <Text style={[
              styles.modeButtonText,
              showContainers && styles.modeButtonTextActive
            ]}>
              Containers ({selectedContainers.size})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <FilterBar
          value={filters.search}
          onChangeText={(text) => setFilters(prev => ({ ...prev, search: text }))}
          placeholder="Rechercher..."
          onCategoryChange={(categoryId) => 
            setFilters(prev => ({ ...prev, categoryId: categoryId || null }))}
          onContainerChange={(containerId) => 
            setFilters(prev => ({ ...prev, containerId: containerId === 'none' ? null : containerId || null }))}
          onStatusChange={(status) => 
            setFilters(prev => ({ ...prev, status }))}
          onPriceChange={(min, max) => 
            setFilters(prev => ({ 
              ...prev, 
              minPrice: min?.toString() || '', 
              maxPrice: max?.toString() || '' 
            }))}
        />

        <View style={styles.dateFilters}>
          {Platform.OS === 'web' ? (
            <>
              <View style={[styles.dateButton, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e9ecef' }]}>
                <MaterialIcons name="calendar-today" size={20} color="#007AFF" />
                <input
                  type="date"
                  className="web-date-input"
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: '#333',
                    fontSize: '14px',
                    padding: '8px',
                    cursor: 'pointer',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    width: '100%',
                    outline: 'none',
                    borderRadius: '8px'
                  }}
                  value={filters.startDate ? format(filters.startDate, 'yyyy-MM-dd') : ''}
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : null;
                    setFilters(prev => ({ ...prev, startDate: date }));
                  }}
                  placeholder="Date début"
                />
                {filters.startDate && (
                  <TouchableOpacity onPress={() => handleResetDate('start')}>
                    <MaterialIcons name="close" size={20} color="#666" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={[styles.dateButton, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e9ecef' }]}>
                <MaterialIcons name="calendar-today" size={20} color="#007AFF" />
                <input
                  type="date"
                  className="web-date-input"
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: '#333',
                    fontSize: '14px',
                    padding: '8px',
                    cursor: 'pointer',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    width: '100%',
                    outline: 'none',
                    borderRadius: '8px'
                  }}
                  value={filters.endDate ? format(filters.endDate, 'yyyy-MM-dd') : ''}
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : null;
                    setFilters(prev => ({ ...prev, endDate: date }));
                  }}
                  placeholder="Date fin"
                />
                {filters.endDate && (
                  <TouchableOpacity onPress={() => handleResetDate('end')}>
                    <MaterialIcons name="close" size={20} color="#666" />
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker('start')}
              >
                <MaterialIcons name="calendar-today" size={20} color="#666" />
                <Text style={styles.dateButtonText}>
                  {filters.startDate
                    ? format(filters.startDate, 'dd/MM/yyyy', { locale: fr })
                    : 'Date début'}
                </Text>
                {filters.startDate && (
                  <TouchableOpacity 
                    onPress={() => handleResetDate('start')}
                    style={{ padding: 4 }}
                  >
                    <MaterialIcons name="close" size={20} color="#666" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker('end')}
              >
                <MaterialIcons name="calendar-today" size={20} color="#666" />
                <Text style={styles.dateButtonText}>
                  {filters.endDate
                    ? format(filters.endDate, 'dd/MM/yyyy', { locale: fr })
                    : 'Date fin'}
                </Text>
                {filters.endDate && (
                  <TouchableOpacity 
                    onPress={() => handleResetDate('end')}
                    style={{ padding: 4 }}
                  >
                    <MaterialIcons name="close" size={20} color="#666" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {showDatePicker && Platform.OS !== 'web' && (Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint="light" style={styles.datePickerContainer}>
            <DateTimePicker
              value={filters[showDatePicker === 'start' ? 'startDate' : 'endDate'] || new Date()}
              mode="date"
              display="spinner"
              onChange={handleDateChange}
            />
            <TouchableOpacity
              style={styles.closeDatePickerButton}
              onPress={() => setShowDatePicker(null)}
            >
              <Text style={styles.closeDatePickerButtonText}>Fermer</Text>
            </TouchableOpacity>
          </BlurView>
        ) : (
          <DateTimePicker
            value={filters[showDatePicker === 'start' ? 'startDate' : 'endDate'] || new Date()}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        ))}

        <View style={styles.selectionSection}>
          <View style={styles.selectionHeader}>
            <Text style={styles.sectionTitle}>
              {showContainers ? 'Containers' : 'Articles'} sélectionnés ({
                showContainers ? selectedContainers.size : selectedItems.size
              })
            </Text>
            <View style={styles.selectionActions}>
              <TouchableOpacity
                style={styles.selectionButton}
                onPress={handleSelectAll}
              >
                <MaterialIcons name="select-all" size={20} color="#007AFF" />
                <Text style={styles.selectionButtonText}>Tout sélectionner</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.selectionButton}
                onPress={handleDeselectAll}
              >
                <MaterialIcons name="clear-all" size={20} color="#FF3B30" />
                <Text style={[styles.selectionButtonText, styles.deselectButtonText]}>
                  Tout désélectionner
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.itemList}>
            {(showContainers ? containers : filteredItems).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.itemRow,
                  (showContainers ? selectedContainers : selectedItems).has(item.id!) && 
                  styles.itemRowSelected
                ]}
                onPress={() => handleToggleItem(item.id!)}
              >
                <View style={styles.itemInfo}>
                  <Text style={[
                    styles.itemName,
                    (showContainers ? selectedContainers : selectedItems).has(item.id!) && 
                    styles.itemNameSelected
                  ]}>
                    {item.name}
                  </Text>
                  {!showContainers && (
                    <Text style={styles.itemContainer}>
                      {containers?.find(c => ('containerId' in item && item.containerId === c.id))?.name || 'Sans container'}
                    </Text>
                  )}
                </View>
                <MaterialIcons
                  name={(showContainers ? selectedContainers : selectedItems).has(item.id!) 
                    ? "check-circle" 
                    : "radio-button-unchecked"}
                  size={24}
                  color={(showContainers ? selectedContainers : selectedItems).has(item.id!) 
                    ? "#007AFF" 
                    : "#666"}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {(showContainers ? selectedContainers.size : selectedItems.size) > 0 && (
          <View style={styles.generatorContainer}>
            <LabelGenerator
              items={getItemsToGenerate()}
              onComplete={() => {
                if (showContainers) {
                  setSelectedContainers(new Set());
                } else {
                  setSelectedItems(new Set());
                }
              }}
              onError={(error) => {
                console.error(error);
                Alert.alert(
                  'Erreur',
                  'Une erreur est survenue lors de la génération des étiquettes'
                );
              }}
              mode={showContainers ? 'containers' : 'items'}
              compact={true}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#f1f3f5',
    borderRadius: 12,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modeButtonText: {
    fontSize: 16,
    color: '#666',
  },
  modeButtonTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 12,
  },
  dateFilters: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f3f5',
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  dateButtonText: {
    fontSize: 14,
    color: '#666',
  },
  datePickerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    zIndex: 1000,
  },
  closeDatePickerButton: {
    alignItems: 'center',
    padding: 16,
  },
  closeDatePickerButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  selectionSection: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectionActions: {
    flexDirection: 'row',
    gap: 12,
  },
  selectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectionButtonText: {
    fontSize: 14,
    color: '#007AFF',
  },
  deselectButtonText: {
    color: '#FF3B30',
  },
  itemList: {
    flex: 1,
    minHeight: 200,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#f8f9fa',
  },
  itemRowSelected: {
    backgroundColor: '#e8f2ff',
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 16,
    marginBottom: 4,
    color: '#212529',
  },
  itemNameSelected: {
    color: '#007AFF',
    fontWeight: '500',
  },
  itemContainer: {
    fontSize: 14,
    color: '#666',
  },
  generatorContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    padding: 8,
    zIndex: 1000,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 12,
  },
}); 