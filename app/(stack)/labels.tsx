import React, { useState, useMemo, useCallback, useEffect, useId } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert, TextInput, ActivityIndicator, FlatList, SafeAreaView } from 'react-native'; 
import { Icon } from '../../src/components';
import type { Item } from '../../src/types/item';
import type { Container } from '../../src/types/container';
import { useRouter } from 'expo-router';
import { useCategories } from '../../src/hooks/useCategories';
import { useContainers } from '../../src/hooks/useContainers';
import * as Sentry from '@sentry/react-native';
import DatePicker, { registerLocale, setDefaultLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { fr } from 'date-fns/locale/fr';
registerLocale('fr', fr);
setDefaultLocale('fr'); 
import Select, { ActionMeta, SingleValue, GroupBase } from 'react-select'; 

import { searchItems, SearchFilters } from '../../src/services/searchService';
import { useAppTheme } from '../../src/contexts/ThemeContext';

interface Filters {
  categoryId: number | null;
  containerId: number | null | 'none';
  minPrice: string;
  maxPrice: string;
  startDate: Date | null;
  endDate: Date | null;
  status: 'all' | 'available' | 'sold';
}

type SelectOption<TValue = number | 'none' | null> = {
  value: TValue;
  label: string;
};

const LabelScreenContent = () => {
  const router = useRouter();
  const { activeTheme } = useAppTheme();
  const styles = useMemo(() => getThemedStyles(activeTheme), [activeTheme]);
  const selectStyles = useMemo(() => customReactSelectStyles(activeTheme), [activeTheme]);

  // Generate stable IDs for select components
  const categorySelectId = useId();
  const containerSelectId = useId();

  // Au lieu de stocker juste les IDs, on stocke les objets complets
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectedContainers, setSelectedContainers] = useState<Set<number>>(new Set());

  // Maps pour stocker les détails complets des articles/conteneurs sélectionnés
  const [selectedItemsMap, setSelectedItemsMap] = useState<Map<number, Item>>(new Map());  
  const [selectedContainersMap, setSelectedContainersMap] = useState<Map<number, Container>>(new Map());
  const [showContainers, setShowContainers] = useState(false);
  
  const [filters, setFilters] = useState<Filters>({
    categoryId: null,
    containerId: null,
    minPrice: '',
    maxPrice: '',
    startDate: null,
    endDate: null,
    status: 'all'
  });

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);

  const { categories, isLoading: isLoadingCategories } = useCategories();
  const { data: containers, isLoading: isLoadingContainers } = useContainers();
  
  const staticData = useMemo(() => ({
    categories: categories || [],
    containers: containers || []
  }), [categories, containers]);
  
  const isLoadingStaticData = isLoadingCategories || isLoadingContainers;

  const performSearch = useCallback(async (currentSearchQuery: string, currentFilters: Filters) => {
    setIsLoadingSearch(true);
    try {
      const supabaseFilters: SearchFilters = {
        search: currentSearchQuery.trim() || undefined, 
        status: currentFilters.status === 'all' ? undefined : currentFilters.status,
        pageSize: 1000, 
      };

      if (currentFilters.categoryId) {
        supabaseFilters.categoryId = currentFilters.categoryId;
      }
      
      if (currentFilters.containerId === 'none') {
        supabaseFilters.containerId = 'none';
      } else if (currentFilters.containerId) {
        supabaseFilters.containerId = currentFilters.containerId;
      }

      const minPriceNum = parseFloat(currentFilters.minPrice);
      if (!isNaN(minPriceNum)) {
        supabaseFilters.minPrice = minPriceNum;
      }
      const maxPriceNum = parseFloat(currentFilters.maxPrice);
      if (!isNaN(maxPriceNum)) {
        supabaseFilters.maxPrice = maxPriceNum;
      }
      const result = await searchItems(supabaseFilters);
      setSearchResults(result.items || []);
    } catch (error) {
      Sentry.captureException(error, { tags: { type: 'labels_supabase_search_error' } });
      setSearchResults([]);
      Alert.alert('Erreur de recherche', 'Une erreur est survenue lors de la recherche des articles.');
    } finally {
      setIsLoadingSearch(false);
    }
  }, []);

  useEffect(() => {
    performSearch(debouncedSearchQuery, filters);
  }, [debouncedSearchQuery, filters, performSearch]);

  const displayedList = useMemo(() => {
    let itemsToDisplay: Item[] = searchResults;

    if (filters.startDate || filters.endDate) {
      itemsToDisplay = itemsToDisplay.filter(item => {
        if (!item.createdAt) return false;
        const itemDate = new Date(item.createdAt);
        if (filters.startDate && itemDate < filters.startDate) return false;
        if (filters.endDate) {
          const endOfDay = new Date(filters.endDate);
          endOfDay.setHours(23, 59, 59, 999);
          if (itemDate > endOfDay) return false;
        }
        return true;
      });
    }
    
    let finalDisplayList: (Item | Container)[] = []; 
    if (showContainers) {
      if (staticData?.containers) {
        if (debouncedSearchQuery) {
          finalDisplayList = staticData.containers.filter(c => 
            c.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
          );
        } else {
          finalDisplayList = staticData.containers;
        }
      } else {
        finalDisplayList = []; 
      }
    } else {
      finalDisplayList = itemsToDisplay;
    }
    return finalDisplayList;
  }, [searchResults, filters, showContainers, staticData, debouncedSearchQuery]);

  const itemsToDisplayInList = useMemo(() => {
    if (showContainers) {
      return (displayedList as Container[]).map(c => ({ ...c, type: 'container' as const }));
    }
    return (displayedList as Item[]).map(i => ({ ...i, type: 'item' as const }));
  }, [displayedList, showContainers]);

  const handleCategoryChange = useCallback(
    (selectedOption: SingleValue<SelectOption<number | null>>, _actionMeta: ActionMeta<SelectOption<number | null>>) => {
      setFilters(prev => ({ ...prev, categoryId: selectedOption ? selectedOption.value : null }));
    },
    []
  );

  const handleContainerChange = useCallback(
    (selectedOption: SingleValue<SelectOption<number | 'none' | null>>, _actionMeta: ActionMeta<SelectOption<number | 'none' | null>>) => {
      setFilters(prev => ({ ...prev, containerId: selectedOption ? selectedOption.value : null }));
    },
    []
  );

  const handleStatusChange = (status: 'all' | 'available' | 'sold') => {
    setFilters(prev => ({ ...prev, status }));
  };

  const handlePriceChange = (min: string, max: string) => {
    setFilters(prev => ({ ...prev, minPrice: min, maxPrice: max }));
  };

  const handleDateChange = (_event: any, selectedDate: Date | null | undefined, type: 'start' | 'end') => {
    if (selectedDate !== undefined) { 
        setFilters(prev => ({ ...prev, [type === 'start' ? 'startDate' : 'endDate']: selectedDate }));
    }
  };

  const handleResetDate = (type: 'start' | 'end') => {
    setFilters(prev => ({ ...prev, [type === 'start' ? 'startDate' : 'endDate']: null }));
  };

  const handleToggleItem = (itemId: number) => {
    const item = (displayedList as Item[]).find(i => i.id === itemId);
    if (!item) {
      console.warn(`[LabelsScreen] Item with ID ${itemId} not found in displayedList`);
      return;
    }

    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
        
        const newItemsMap = new Map(selectedItemsMap);
        newItemsMap.delete(itemId);
        setSelectedItemsMap(newItemsMap);
      } else {
        newSet.add(itemId);
        
        const newItemsMap = new Map(selectedItemsMap);
        newItemsMap.set(itemId, item);
        setSelectedItemsMap(newItemsMap);
      }
      console.log('[LabelsScreen] handleToggleItem - new selectedItems:', newSet);
      return newSet;
    });
  };

  const handleToggleContainer = (containerId: number) => {
    const container = (displayedList as Container[]).find(c => c.id === containerId);
    if (!container) {
      console.warn(`[LabelsScreen] Container with ID ${containerId} not found in displayedList`);
      return;
    }

    setSelectedContainers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(containerId)) {
        newSet.delete(containerId);
        
        const newContainersMap = new Map(selectedContainersMap);
        newContainersMap.delete(containerId);
        setSelectedContainersMap(newContainersMap);
      } else {
        newSet.add(containerId);
        
        const newContainersMap = new Map(selectedContainersMap);
        newContainersMap.set(containerId, container);
        setSelectedContainersMap(newContainersMap);
      }
      console.log('[LabelsScreen] handleToggleContainer - new selectedContainers:', newSet);
      return newSet;
    });
  };

  const handleDeselectAll = () => {
    if (showContainers) {
      const containersToDeselect = displayedList as Container[];
      const newSelectedContainers = new Set(selectedContainers);
      const newContainersMap = new Map(selectedContainersMap);
      
      containersToDeselect.forEach(container => {
        newSelectedContainers.delete(container.id);
        newContainersMap.delete(container.id);
      });
      
      setSelectedContainers(newSelectedContainers);
      setSelectedContainersMap(newContainersMap);
    } else {
      const itemsToDeselect = displayedList as Item[];
      const newSelectedItems = new Set(selectedItems);
      const newItemsMap = new Map(selectedItemsMap);
      
      itemsToDeselect.forEach(item => {
        newSelectedItems.delete(item.id);
        newItemsMap.delete(item.id);
      });
      
      setSelectedItems(newSelectedItems);
      setSelectedItemsMap(newItemsMap);
    }
  };

  const handleSelectAll = () => {
    if (showContainers) {
      const containers = displayedList as Container[];
      const allContainerIds = containers.map(c => c.id);
      setSelectedContainers(new Set(allContainerIds));
      
      const newContainersMap = new Map(selectedContainersMap);
      containers.forEach(container => {
        newContainersMap.set(container.id, container);
      });
      setSelectedContainersMap(newContainersMap);
    } else {
      const items = displayedList as Item[];
      const allItemIds = items.map(i => i.id);
      setSelectedItems(new Set(allItemIds));
      
      const newItemsMap = new Map(selectedItemsMap);
      items.forEach(item => {
        newItemsMap.set(item.id, item);
      });
      setSelectedItemsMap(newItemsMap);
    }
  };

  type LabelData = {
    id: number;
    name: string;
    description?: string | null;
    sellingPrice?: number | null; 
    number?: string | null; 
    qrCode: string;
  };

  const getItemsToGenerate = useCallback((): LabelData[] => {
    console.log('[LabelsScreen] getItemsToGenerate called.');
    console.log('[LabelsScreen] showContainers:', showContainers);
    console.log('[LabelsScreen] selectedItemsMap size:', selectedItemsMap.size);
    console.log('[LabelsScreen] selectedContainersMap size:', selectedContainersMap.size);

    if (showContainers) {
      const containers = Array.from(selectedContainersMap.values());
      console.log('[LabelsScreen] Selected containers from Map:', containers);
      
      return containers.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        number: c.number?.toString() || '',
        qrCode: c.qrCode || `CONT_${c.id.toString().padStart(4, '0')}`
      }));
    } else {
      const items = Array.from(selectedItemsMap.values());
      console.log('[LabelsScreen] Selected items from Map:', items);
      
      return items.map(i => ({
        id: i.id,
        name: i.name,
        description: i.description,
        sellingPrice: i.sellingPrice,
        qrCode: i.qrCode || `ART_${i.id.toString().padStart(4, '0')}`
      }));
    }
  }, [showContainers, selectedItemsMap, selectedContainersMap]);

  type RenderableListItem = typeof itemsToDisplayInList[number];

  const renderItem = ({ item }: { item: RenderableListItem }) => {
    const isSelected = item.type === 'item'
      ? selectedItems.has(item.id)
      : selectedContainers.has(item.id);

    const onPress = () => {
      if (item.type === 'item') {
        handleToggleItem(item.id);
      } else {
        handleToggleContainer(item.id);
      }
    };

    return (
      <TouchableOpacity onPress={onPress} style={[styles.itemRow, isSelected && styles.itemRowSelected]}>
        <View style={styles.itemContent}>
          <View style={styles.itemTextContainer}>
            <Text style={[styles.itemName, isSelected && styles.itemNameSelected]}>{item.name}</Text>
            {item.type === 'item' && (
              <>
                {item.description && (
                  <Text style={[styles.itemDescription, isSelected && styles.itemDescriptionSelected]} numberOfLines={1}>
                    {item.description}
                  </Text>
                )}
                <Text style={[styles.itemContainerName, isSelected && styles.itemContainerNameSelected]}>
                  Conteneur: {staticData?.containers?.find(c => c.id === (item as Item).containerId)?.name || 'N/A'}
                </Text> 
                {typeof (item as Item).sellingPrice === 'number' && (
                  <Text style={[styles.itemPrice, isSelected && styles.itemPriceSelected]}>Prix: {(item as Item).sellingPrice.toFixed(2)} €</Text>
                )}
              </>
            )}
            {item.type === 'container' && (item as Container).number && (
              <Text style={[styles.itemDescription, isSelected && styles.itemDescriptionSelected]}>
                Numéro: {(item as Container).number}
              </Text>
            )}
          </View>
          <Icon
            name={isSelected ? "check_box" : "check_box_outline_blank"}
            size={24}
            color={isSelected ? activeTheme.primary : activeTheme.text.secondary}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const ListEmptyComponent = () => {
    if (isLoadingSearch) {
      return (
        <View style={styles.centeredLoading}>
          <ActivityIndicator size="large" color={activeTheme.primary} />
          <Text style={styles.loadingText}>Recherche en cours...</Text>
        </View>
      );
    }
    return (
      <View style={styles.noResultsContainer}>
        <Icon name="search_off" size={48} color={activeTheme.text.secondary} />
        <Text style={styles.noResultsText}>
          Aucun {showContainers ? 'conteneur trouvé' : 'article trouvé'}.
          {Platform.OS !== 'web' && '\n'}Essayez d'ajuster vos filtres ou votre recherche.
        </Text>
      </View>
    );
  };

  const { categoryOptions, containerOptions } = useMemo(() => {
    const baseCategoryOptions: SelectOption<number | null>[] = [
      { value: null, label: 'Toutes les catégories' },
      ...(staticData?.categories.map(cat => ({ value: cat.id, label: cat.name })) || [])
    ];

    const baseContainerOptions: SelectOption<number | 'none' | null>[] = [
      { value: null, label: 'Tous les conteneurs (articles)' },
      { value: 'none', label: 'Aucun conteneur (articles hors conteneur)' },
      ...(staticData?.containers.map(con => ({ value: con.id, label: con.name })) || [])
    ];
    
    return { 
      categoryOptions: baseCategoryOptions,
      containerOptions: baseContainerOptions
    };
  }, [staticData?.categories, staticData?.containers]);

  const CustomDateInput = React.forwardRef<
    React.ElementRef<typeof TouchableOpacity>, 
    { value?: string; onClick?: () => void; type: 'start' | 'end'; hasValue?: boolean }
  >(({ value, onClick, type, hasValue }, ref) => (
    <TouchableOpacity style={styles.dateButton} onPress={onClick} ref={ref}>
      <View style={styles.dateButtonContentView}> 
        <Icon name="calendar_today" size={20} color={activeTheme.text.secondary} style={styles.dateButtonIcon} />
        <Text style={styles.dateButtonTextValue}>{value || (type === 'start' ? 'Date début' : 'Date fin')}</Text>
        {hasValue && (
          <TouchableOpacity 
            onPress={(e) => { 
              e.stopPropagation(); 
              handleResetDate(type); 
            }} 
            style={styles.dateClearButton}
          >
            <Icon name="close" size={18} color={activeTheme.text.secondary} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  ));

  if (isLoadingStaticData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Chargement des données...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBarContainer}> 
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(stack)/settings')}
        >
          <Icon 
            name={Platform.OS === 'ios' ? 'arrow_back_ios' : 'arrow_back'} 
            size={24} 
            color={activeTheme.primary} 
            style={Platform.OS === 'ios' ? { marginRight: 5 } : {}}
          />
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Générer Étiquettes</Text>
        <View style={{ width: Platform.OS === 'ios' ? 80 : 50 }} /> 
      </View>

      <View style={styles.segmentContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, !showContainers && styles.tabButtonActive]} 
          onPress={() => setShowContainers(false)} >
          <Text style={[styles.tabButtonText, !showContainers && styles.tabButtonTextActive]}>Articles</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, showContainers && styles.tabButtonActive]} 
          onPress={() => setShowContainers(true)} >
          <Text style={[styles.tabButtonText, showContainers && styles.tabButtonTextActive]}>Conteneurs</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBarContainer}>
        <Icon name="search" size={24} color={activeTheme.text.secondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={showContainers ? "Rechercher conteneurs..." : "Rechercher articles..."}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={activeTheme.text.secondary}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
            <Icon name="close" size={20} color={activeTheme.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {!showContainers && (
        <View style={styles.filtersSectionContainer}>
          <View style={styles.filterDropdownsRow}>
            <View style={styles.dropdownWrapper}> 
              <Text style={styles.filterTitle}>Catégorie:</Text>
              <Select<SelectOption<number | null>, false, GroupBase<SelectOption<number | null>>>
                instanceId={`category-select-${categorySelectId}`}
                options={categoryOptions}
                value={categoryOptions.find(opt => opt.value === filters.categoryId)}
                onChange={handleCategoryChange}
                placeholder="Catégorie"
                styles={selectStyles}
                isClearable
                menuPortalTarget={document.body} 
              />
            </View>
            <View style={styles.dropdownWrapper}>
              <Text style={styles.filterTitle}>Conteneur (Article):</Text>
              <Select<SelectOption<number | 'none' | null>, false, GroupBase<SelectOption<number | 'none' | null>>>
                instanceId={`container-select-${containerSelectId}`}
                options={containerOptions as ReadonlyArray<SelectOption<number | 'none' | null> | GroupBase<SelectOption<number | 'none' | null>>>}
                value={containerOptions.find(opt => opt.value === filters.containerId) as SelectOption<number | 'none' | null> | undefined}
                onChange={handleContainerChange}
                placeholder="Sélectionner conteneur"
                styles={selectStyles}
                isClearable
                menuPortalTarget={document.body} 
              />
            </View>
          </View>

          <View style={styles.filtersBar}>
            <View style={styles.priceInputsContainer}>
              <View style={styles.priceInputWrapper}>
                <TextInput
                  style={styles.priceInput}
                  value={filters.minPrice}
                  onChangeText={(text) => handlePriceChange(text, filters.maxPrice)}
                  placeholder="Prix min"
                  keyboardType="numeric"
                  placeholderTextColor={activeTheme.text.secondary}
                />
              </View>
              <View style={styles.priceSeparator} />
              <View style={styles.priceInputWrapper}>
                <TextInput
                  style={styles.priceInput}
                  value={filters.maxPrice}
                  onChangeText={(text) => handlePriceChange(filters.minPrice, text)}
                  placeholder="Prix max"
                  keyboardType="numeric"
                  placeholderTextColor={activeTheme.text.secondary}
                />
              </View>
            </View>
          </View>

          <View style={styles.filtersBar}>
            <Text style={styles.filterTitle}>Statut:</Text>
            {(['all', 'available', 'sold'] as const).map(statusValue => (
              <TouchableOpacity 
                key={statusValue} 
                style={[styles.filterChip, filters.status === statusValue && styles.filterChipActive]} 
                onPress={() => handleStatusChange(statusValue)}>
                <Text style={[styles.filterChipText, filters.status === statusValue && styles.filterChipTextActive]}>
                  {statusValue === 'all' ? 'Tous' : statusValue === 'available' ? 'Disponibles' : 'Vendus'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.dateFiltersContainer}>
            <View style={styles.datePickerWrapper}> 
              <DatePicker
                selected={filters.startDate}
                onChange={(date) => handleDateChange(null, date, 'start')}
                customInput={<CustomDateInput type="start" hasValue={!!filters.startDate} />}
                locale="fr"
                dateFormat="P"
                popperPlacement="bottom-start"
                placeholderText="Date début"
                isClearable={false}
                portalId="datepicker-portal" 
              />
            </View>
            <View style={styles.datePickerWrapper}> 
              <DatePicker
                selected={filters.endDate}
                onChange={(date) => handleDateChange(null, date, 'end')}
                customInput={<CustomDateInput type="end" hasValue={!!filters.endDate} />}
                locale="fr"
                dateFormat="P"
                popperPlacement="bottom-start"
                placeholderText="Date fin"
                isClearable={false}
                minDate={filters.startDate ? filters.startDate : undefined}
                portalId="datepicker-portal" 
              />
            </View>
          </View>
        </View>
      )}

      <View style={styles.selectionHeader}>
        <Text style={styles.selectionCountText}>
          {showContainers ? selectedContainers.size : selectedItems.size} {showContainers ? 'conteneur(s)' : 'article(s)'} sélectionné(s)
        </Text>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity style={styles.selectionButton} onPress={handleSelectAll}>
            <Icon name="done_all" size={18} color={activeTheme.primary} />
            <Text style={styles.selectionButtonText}>Tout Sél.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.selectionButton} onPress={handleDeselectAll}>
            <Icon name="deselect" size={18} color="#777" />
            <Text style={styles.selectionButtonText}>Tout Désél.</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={itemsToDisplayInList}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        ListEmptyComponent={ListEmptyComponent}
        contentContainerStyle={styles.listContentContainer}
        style={{ backgroundColor: 'transparent' }} 
        extraData={showContainers ? selectedContainers : selectedItems}
      />

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.clearAllButton} 
          onPress={() => {
            // Vider TOUTES les sélections (pas seulement la liste actuelle)
            setSelectedItems(new Set());
            setSelectedItemsMap(new Map());
            setSelectedContainers(new Set());
            setSelectedContainersMap(new Map());
          }} 
        >
          <Icon name="delete_sweep" size={20} color={activeTheme.primary} style={styles.buttonIcon} />
          <Text style={styles.clearAllButtonText}>Tout Vider</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.generateButton} 
          onPress={() => {
            const itemsToGen = getItemsToGenerate();
            console.log('[LabelsScreen] onPress - itemsToGen:', itemsToGen);

            if (itemsToGen.length === 0) {
              Alert.alert('Aucune sélection', 'Veuillez sélectionner des articles ou des conteneurs pour générer des étiquettes.');
              return;
            }
            
            const mode = showContainers ? 'containers' : 'items';
            console.log('[LabelsScreen] Navigating to /label-preview with params:', { items: JSON.stringify(itemsToGen), mode });
            router.push({ 
              pathname: '/label-preview', 
              params: { items: JSON.stringify(itemsToGen), mode }
            });
          }}
        >
          <Icon name="label" size={20} color="#fff" style={styles.buttonIcon} />
          <Text style={styles.generateButtonText}>Générer Étiquettes ({showContainers ? selectedContainers.size : selectedItems.size})</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

const LabelScreen = () => {
  return <LabelScreenContent />;
};

const getThemedStyles = (theme: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  topBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    height: Platform.OS === 'ios' ? 44 : 56, 
    backgroundColor: theme.background, 
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10, 
    paddingHorizontal: 8,
    minWidth: Platform.OS === 'ios' ? 80 : 50, 
    justifyContent: 'flex-start',
  },
  backButtonText: { 
    color: theme.primary,
    fontSize: 17,
    marginLeft: 5,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: Platform.OS === 'ios' ? '600' : '500',
    color: theme.text.primary,
    textAlign: 'center',
    flexShrink: 1, 
  },
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginHorizontal: 10,
    marginVertical: 8, 
    height: 40, 
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    fontSize: 16,
    color: theme.text.primary,
    height: '100%',
  },
  clearSearchButton: {
    padding: 4,
  },
  filtersSectionContainer: { 
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  filterDropdownsRow: { 
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dropdownWrapper: { 
    flex: 1,
    marginHorizontal: 4, // Added some spacing between dropdowns
  },
  filtersBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4, // Reduced padding for tighter filter bar
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  filterTitle: {
    fontSize: 14,
    color: theme.text.secondary,
    marginRight: 8,
    alignSelf: 'center',
  },
  priceInputsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceInputWrapper: {
    flex: 1,
    maxWidth: '50%',
  },
  priceSeparator: {
    width: 12,
  },
  priceInput: {
    height: 38,
    width: '100%',
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 4,
    backgroundColor: theme.surface,
    fontSize: 14,
    color: theme.text.primary,
    paddingHorizontal: 10,
  },
  dateFiltersContainer: {
    flexDirection: 'row', // Added
    alignItems: 'center', // Added
    // justifyContent: 'space-around', // Removed or changed
    marginVertical: 8, // Added some vertical margin for spacing
  },
  datePickerWrapper: { // Added new style
    flex: 1,
    marginHorizontal: 4, // Add some space between date pickers
  },
  dateButton: {  
    backgroundColor: theme.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    height: 38, // Match react-select height
    justifyContent: 'center',
    width: '100%', // Added to ensure the button fills the wrapper
  },
  dateButtonContentView: { // ADDED: dateButtonContentView style definition
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%', // Ensure this view also spans the full width of the button
  },
  dateButtonIcon: { // ADDED: dateButtonIcon style definition
    marginRight: 6, 
  },
  dateButtonTextValue: { // ADDED: dateButtonTextValue style definition
    fontSize: 14,
    color: theme.text.secondary,
    flex: 1,
  },
  dateClearButton: { // ADDED: dateClearButton style definition
    paddingLeft: 8, 
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChip: { // ADDED: filterChip style definition
    paddingHorizontal: 12,
    paddingVertical: 8, // Increased vertical padding for better touch area
    borderRadius: 16,
    backgroundColor: theme.surface,
    marginHorizontal: 4, // Consistent margin
    borderWidth: 1,
    borderColor: 'transparent',
    height: 38, // Match other filter controls
    justifyContent: 'center',
  },
  filterChipActive: { // ADDED: filterChipActive style definition
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  filterChipText: { // ADDED: filterChipText style definition
    color: theme.text.secondary,
    fontSize: 14,
  },
  filterChipTextActive: { // ADDED: filterChipTextActive style definition
    color: theme.text.onPrimary,
    fontWeight: '500',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: theme.surface, 
    borderRadius: 8,
    marginHorizontal: 10,
    marginTop: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface, 
    borderRadius: 8, 
  },
  tabButtonActive: {
    backgroundColor: theme.primary, 
  },
  tabButtonText: {
    fontSize: 15,
    color: theme.text.primary, 
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: theme.text.onPrimary,
    fontWeight: 'bold',
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  selectionCountText: {
    fontSize: 14,
    color: theme.text.secondary,
    fontWeight: '500',
  },
  selectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  selectionButtonText: {
    marginLeft: 4,
    fontSize: 14,
    color: theme.text.primary,
    fontWeight: '500',
  },
  filterButton: {
    padding: 10,
    backgroundColor: theme.primary,
    borderRadius: 8,
  },
  datePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  dateInputContainer: {
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 14,
    color: theme.text.primary,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 4,
    color: theme.text.primary,
    minWidth: 100,
    textAlign: 'center',
  },
  itemCountText: {
    textAlign: 'center',
    marginVertical: 8,
    fontSize: 14,
    color: theme.text.secondary,
  },
  listContentContainer: {
    paddingBottom: 80,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  itemRowSelected: {
    backgroundColor: theme.primaryLight,
    borderLeftWidth: 3,
    borderLeftColor: theme.primary,
  },
  itemInfo: { flex: 1, marginRight: 12 },
  itemName: { fontSize: 16, marginBottom: 4, color: theme.text.primary, fontWeight: 'bold' },
  itemNameSelected: { color: theme.primary },
  itemDescription: {
    fontSize: 13,
    color: theme.text.secondary, 
    marginTop: 2,
  },
  itemDescriptionSelected: {
    color: theme.primary, 
  },
  itemContainerName: { 
    fontSize: 12,
    color: theme.text.secondary, 
    marginTop: 4,
  },
  itemContainerNameSelected: {
    color: theme.primary,
  },
  itemContent: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  itemTextContainer: { 
    flex: 1,
    marginRight: 8, // Add some space before the checkbox
  },
  itemPrice: { 
    fontSize: 14,
    color: theme.text.primary,
    marginTop: 2,
  },
  itemPriceSelected: { 
    color: theme.primary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Platform.OS === 'ios' ? 20 : 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
  },
  clearAllButton: {
    backgroundColor: 'transparent',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.primary,
    marginRight: 10, 
    flex: 1,
  },
  clearAllButtonText: {
    color: theme.primary,
    fontSize: 15,
    fontWeight: '500',
  },
  generateButton: {
    backgroundColor: theme.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    flex: 1, 
  },
  generateButtonText: {
    color: theme.text.onPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonIcon: {
    marginRight: 8,
  },
  noResultsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50,
    backgroundColor: theme.surface,
  },
  noResultsText: {
    fontSize: 16,
    color: theme.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 8,
  },
  centeredLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: theme.text.secondary,
  },
  errorText: {
    fontSize: 18,
    color: theme.danger.main,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorDetails: {
    fontSize: 14,
    color: theme.text.secondary,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.background,
  },
});

const customReactSelectStyles = (theme: any) => ({
  control: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: theme.surface,
    borderColor: state.isFocused ? theme.primary : theme.border,
    '&:hover': {
      borderColor: theme.primary,
    },
    minHeight: 38, 
    height: 38,
    boxShadow: 'none',
  }),
  valueContainer: (provided: any) => ({
    ...provided,
    height: 38,
    paddingLeft: 8, 
    paddingRight: 8,
    alignItems: 'center', 
  }),
  input: (provided: any) => ({
    ...provided,
    color: theme.text.primary,
    margin: 0,
    padding: 0,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  }),
  placeholder: (provided: any) => ({
    ...provided,
    color: theme.text.secondary,
    marginLeft: 2,
    marginRight: 2,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  }),
  singleValue: (provided: any) => ({
    ...provided,
    color: theme.text.primary,
    marginLeft: 2,
    marginRight: 2,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  }),
  menu: (provided: any) => ({
    ...provided,
    backgroundColor: theme.background,
    borderRadius: 4,
    marginTop: 4,
  }),
  menuPortal: (base: any) => ({ 
    ...base, 
  }), 
  option: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: state.isSelected ? theme.primary : state.isFocused ? theme.primaryLight : theme.background,
    color: state.isSelected ? theme.text.onPrimary : theme.text.primary,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 14,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    '&:active': {
      backgroundColor: theme.primary,
    },
  }),
  dropdownIndicator: (provided: any) => ({
    ...provided,
    color: theme.text.secondary,
    padding: 6,
  }),
  clearIndicator: (provided: any) => ({
    ...provided,
    color: theme.text.secondary,
    padding: 6,
  }),
});

export default LabelScreen;
