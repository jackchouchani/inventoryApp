import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
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
import { useRouter } from 'expo-router';

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

type ListItem = Item | Container;

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
    data,
    isLoading,
    error
  } = useInventoryData({
    search: filters.search,
    categoryId: filters.categoryId || undefined,
    containerId: filters.containerId || undefined,
    status: filters.status === 'all' ? undefined : filters.status,
    minPrice: filters.minPrice ? parseFloat(filters.minPrice) : undefined,
    maxPrice: filters.maxPrice ? parseFloat(filters.maxPrice) : undefined
  });

  const items = data?.items || [];
  const containers = data?.containers || [];
  const categories = data?.categories || [];

  const router = useRouter();

  const handleSearchChange = useCallback((text: string) => 
    setFilters(prev => ({ ...prev, search: text })), []);

  const handleStatusChange = useCallback((status: 'all' | 'available' | 'sold') => 
    setFilters(prev => ({ ...prev, status })), []);

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

  const handleToggleItem = useCallback((itemId: number) => {
    if (showContainers) {
      setSelectedContainers(prev => {
        const newSelected = new Set(prev);
        if (newSelected.has(itemId)) {
          newSelected.delete(itemId);
        } else {
          newSelected.add(itemId);
        }
        return newSelected;
      });
    } else {
      setSelectedItems(prev => {
        const newSelected = new Set(prev);
        if (newSelected.has(itemId)) {
          newSelected.delete(itemId);
        } else {
          newSelected.add(itemId);
        }
        return newSelected;
      });
    }
  }, [showContainers]);

  const handleSelectAll = useCallback(() => {
    if (showContainers) {
      const newSelected = new Set(containers?.map(container => container.id!) || []);
      setSelectedContainers(newSelected);
    } else {
      const newSelected = new Set(filteredItems.map(item => item.id!));
      setSelectedItems(newSelected);
    }
  }, [showContainers, containers, filteredItems]);

  const handleDeselectAll = useCallback(() => {
    if (showContainers) {
      setSelectedContainers(new Set());
    } else {
      setSelectedItems(new Set());
    }
  }, [showContainers]);

  const handleDateChange = useCallback((_event: any, selectedDate: Date | undefined) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(null);
    }

    if (selectedDate) {
      setFilters(prev => ({
        ...prev,
        [showDatePicker === 'start' ? 'startDate' : 'endDate']: selectedDate
      }));
    }
  }, [showDatePicker]);

  const handleResetDate = useCallback((type: 'start' | 'end') => {
    setFilters(prev => ({
      ...prev,
      [type === 'start' ? 'startDate' : 'endDate']: null
    }));
  }, []);

  const getItemsToGenerate = () => {
    if (showContainers) {
      return containers
        ?.filter(container => selectedContainers.has(container.id!))
        .map(container => ({
          id: container.id!,
          name: container.name,
          description: container.description,
          number: container.number?.toString() || '',
          qrCode: container.qrCode || `CONTAINER_${container.id}`
        })) || [];
    }
    
    return filteredItems
      .filter(item => selectedItems.has(item.id!))
      .map(item => ({
        id: item.id!,
        name: item.name,
        description: item.description,
        sellingPrice: item.sellingPrice,
        qrCode: item.qrCode || `ITEM_${item.id}`
      }));
  };

  const handleCategoryChange = useCallback((categoryId: number | undefined) => 
    setFilters(prev => ({ ...prev, categoryId: categoryId || null })), []);

  const handleContainerChange = useCallback((containerId: number | 'none' | undefined) => 
    setFilters(prev => ({ 
      ...prev, 
      containerId: containerId === 'none' ? null : containerId || null 
    })), []);

  const handlePriceChange = useCallback((min: number | undefined, max: number | undefined) => 
    setFilters(prev => ({ 
      ...prev, 
      minPrice: min?.toString() || '', 
      maxPrice: max?.toString() || '' 
    })), []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialIcons name="hourglass-empty" size={48} color="#007AFF" />
        <Text style={styles.loadingText}>Chargement des données...</Text>
      </View>
    );
  }

  if (error) {
    const errorDetails = handleDatabaseError(error);
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>
          {errorDetails.message || 'Une erreur est survenue lors du chargement des données'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.push('/(stack)/settings')}
        >
          <MaterialIcons name="arrow-back-ios" size={18} color="#007AFF" />
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.segmentedControl}>
        <TouchableOpacity
          style={[styles.segmentButton, !showContainers && styles.segmentButtonActive]}
          onPress={() => setShowContainers(false)}
        >
          <MaterialIcons 
            name="shopping-bag" 
            size={20} 
            color={!showContainers ? '#007AFF' : '#666'} 
            style={styles.segmentIcon}
          />
          <Text style={[
            styles.segmentButtonText,
            !showContainers && styles.segmentButtonTextActive
          ]}>
            Articles ({selectedItems.size})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentButton, showContainers && styles.segmentButtonActive]}
          onPress={() => setShowContainers(true)}
        >
          <MaterialIcons 
            name="inbox" 
            size={20} 
            color={showContainers ? '#007AFF' : '#666'} 
            style={styles.segmentIcon}
          />
          <Text style={[
            styles.segmentButtonText,
            showContainers && styles.segmentButtonTextActive
          ]}>
            Containers ({selectedContainers.size})
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mainContent}>
        <View style={styles.filterSection}>
          <FilterBar
            value={filters.search}
            onChangeText={handleSearchChange}
            placeholder="Rechercher..."
            onCategoryChange={handleCategoryChange}
            onContainerChange={handleContainerChange}
            onStatusChange={handleStatusChange}
            onPriceChange={handlePriceChange}
            categories={categories}
            containers={containers}
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
              <Text style={styles.datePickerLabel}>
                {showDatePicker === 'start' ? 'Date de début' : 'Date de fin'}
              </Text>
              <Text style={styles.datePickerSubLabel}>
                {showDatePicker === 'start' 
                  ? 'Sélectionnez la date à partir de laquelle filtrer'
                  : 'Sélectionnez la date jusqu\'à laquelle filtrer'
                }
              </Text>
              <DateTimePicker
                value={filters[showDatePicker === 'start' ? 'startDate' : 'endDate'] || new Date()}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                textColor="#000"
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
        </View>

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
                <MaterialIcons name="check-box" size={18} color="#007AFF" />
                <Text style={styles.selectionButtonText}>Tout sélectionner</Text>
              </TouchableOpacity>
              <Text style={styles.selectionSeparator}>•</Text>
              <TouchableOpacity
                style={styles.selectionButton}
                onPress={handleDeselectAll}
              >
                <MaterialIcons name="check-box-outline-blank" size={18} color="#FF3B30" />
                <Text style={[styles.selectionButtonText, styles.deselectButtonText]}>
                  Tout désélectionner
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <FlatList<ListItem>
            data={showContainers ? containers : filteredItems}
            keyExtractor={item => item.id!.toString()}
            renderItem={({ item }) => (
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
                  {!showContainers && 'containerId' in item && (
                    <Text style={styles.itemContainer}>
                      {containers?.find(c => c.id === item.containerId)?.name || 'Sans container'}
                    </Text>
                  )}
                </View>
                <MaterialIcons
                  name={(showContainers ? selectedContainers : selectedItems).has(item.id!) 
                    ? "check-circle" 
                    : "radio-button-unchecked"}
                  size={22}
                  color={(showContainers ? selectedContainers : selectedItems).has(item.id!) 
                    ? "#007AFF" 
                    : "#CCC"}
                />
              </TouchableOpacity>
            )}
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            windowSize={5}
            contentContainerStyle={styles.itemListContent}
            showsVerticalScrollIndicator={false}
          />
        </View>
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
              router.replace('/(stack)/settings');
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  topBar: {
    height: Platform.OS === 'ios' ? 44 : 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    marginTop: Platform.OS === 'ios' ? 47 : 0,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginLeft: -8,
  },
  backButtonText: {
    fontSize: 17,
    color: '#007AFF',
    marginLeft: -4,
  },
  segmentedControl: {
    flexDirection: 'row',
    margin: 16,
    marginTop: 8,
    backgroundColor: '#f1f3f5',
    borderRadius: 8,
    padding: 4,
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  filterSection: {
    padding: 16,
    paddingTop: 0,
  },
  selectionSection: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  selectionHeader: {
    flexDirection: 'column',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  selectionSeparator: {
    marginHorizontal: 8,
    color: '#CCC',
    fontSize: 12,
  },
  selectionButtonText: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '500',
  },
  deselectButtonText: {
    color: '#FF3B30',
  },
  itemList: {
    flex: 1,
  },
  itemListContent: {
    padding: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  itemRowSelected: {
    backgroundColor: '#f0f9ff',
    borderColor: '#007AFF',
  },
  generatorContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
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
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 16,
    marginBottom: 4,
    color: '#212529',
    fontWeight: '500',
  },
  itemNameSelected: {
    color: '#007AFF',
  },
  itemContainer: {
    fontSize: 14,
    color: '#666',
  },
  segmentIcon: {
    marginRight: 6,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 6,
  },
  segmentButtonActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentButtonText: {
    fontSize: 15,
    color: '#666',
  },
  segmentButtonTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  datePickerLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    marginBottom: 4,
  },
  datePickerSubLabel: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
}); 