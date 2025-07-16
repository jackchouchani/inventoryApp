import React, { useState, useMemo, useCallback, useEffect, useId } from 'react';
import { View, Text, TouchableOpacity, Platform, Alert, TextInput, ActivityIndicator, FlatList, SafeAreaView } from 'react-native'; 
import { Icon } from '../../src/components';
import type { Item } from '../../src/types/item';
import type { Container } from '../../src/types/container';
import { useRouter } from 'expo-router';
import { useUserPermissions } from '../../src/hooks/useUserPermissions';
import { useCategoriesOptimized as useCategories } from '../../src/hooks/useCategoriesOptimized';
import { useAllContainers } from '../../src/hooks/useOptimizedSelectors';
import * as Sentry from '@sentry/react-native';
import DatePicker, { registerLocale, setDefaultLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { fr } from 'date-fns/locale/fr';
registerLocale('fr', fr);
setDefaultLocale('fr'); 
import Select, { ActionMeta, SingleValue, GroupBase } from 'react-select'; 

import { useSelector } from 'react-redux';
import { selectAllItems } from '../../src/store/selectors';
import { useAppTheme } from '../../src/contexts/ThemeContext';

// ✅ STYLEFACTORY selon stylefactory-optimization.mdc
import StyleFactory from '../../src/styles/StyleFactory';

// Composants standardisés
import CommonHeader from '../../src/components/CommonHeader';

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
  
  // ✅ REDUX - Récupération des données depuis le store Redux
  const allItems = useSelector(selectAllItems);
  
  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'Labels');
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

  // ✅ HOOKS OPTIMISÉS - Utiliser les sélecteurs mémoïsés
  const { categories, isLoading: isLoadingCategories } = useCategories();
  const containers = useAllContainers();
  const isLoadingContainers = false; // useAllContainers n'a pas de loading state
  
  const staticData = useMemo(() => ({
    categories: categories || [],
    containers: containers || []
  }), [categories, containers]);
  
  const isLoadingStaticData = isLoadingCategories || isLoadingContainers;

  const performSearch = useCallback((currentSearchQuery: string, currentFilters: Filters) => {
    setIsLoadingSearch(true);
    try {
      // ✅ REDUX - Filtrer les items depuis le store Redux (marche offline et online)
      let filteredItems = [...allItems];

      // Filtre par texte de recherche
      if (currentSearchQuery.trim()) {
        const searchLower = currentSearchQuery.toLowerCase();
        filteredItems = filteredItems.filter(item => 
          item.name.toLowerCase().includes(searchLower) ||
          (item.description && item.description.toLowerCase().includes(searchLower)) ||
          (item.qrCode && item.qrCode.toLowerCase().includes(searchLower))
        );
      }

      // Filtre par statut
      if (currentFilters.status !== 'all') {
        filteredItems = filteredItems.filter(item => item.status === currentFilters.status);
      }

      // Filtre par catégorie
      if (currentFilters.categoryId) {
        filteredItems = filteredItems.filter(item => item.categoryId === currentFilters.categoryId);
      }
      
      // Filtre par conteneur
      if (currentFilters.containerId === 'none') {
        filteredItems = filteredItems.filter(item => !item.containerId);
      } else if (currentFilters.containerId) {
        filteredItems = filteredItems.filter(item => item.containerId === currentFilters.containerId);
      }

      // Filtre par prix minimum
      const minPriceNum = parseFloat(currentFilters.minPrice);
      if (!isNaN(minPriceNum)) {
        filteredItems = filteredItems.filter(item => (item.sellingPrice || 0) >= minPriceNum);
      }

      // Filtre par prix maximum
      const maxPriceNum = parseFloat(currentFilters.maxPrice);
      if (!isNaN(maxPriceNum)) {
        filteredItems = filteredItems.filter(item => (item.sellingPrice || 0) <= maxPriceNum);
      }

      setSearchResults(filteredItems);
    } catch (error) {
      Sentry.captureException(error, { tags: { type: 'labels_redux_search_error' } });
      setSearchResults([]);
      Alert.alert('Erreur de recherche', 'Une erreur est survenue lors de la recherche des articles.');
    } finally {
      setIsLoadingSearch(false);
    }
  }, [allItems]);

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
    if (showContainers) {
      const containers = Array.from(selectedContainersMap.values());
      
      return containers.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        number: c.number?.toString() || '',
        qrCode: c.qrCode || `CONT_${c.id.toString().padStart(4, '0')}`
      }));
    } else {
      const items = Array.from(selectedItemsMap.values());
      
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

    // ✅ AMÉLIORATION - Layout modernisé avec cartes et icônes
    return (
      <TouchableOpacity 
        onPress={onPress} 
        style={[
          styles.itemRow, 
          isSelected && styles.itemRowSelected
        ]}
        activeOpacity={0.7}
      >
        <View style={styles.itemContent}>
          {/* Icône avec indicateur de type */}
          <View style={[styles.itemIcon, isSelected && styles.itemIconSelected]}>
            <Icon
              name={item.type === 'item' ? 'inventory' : 'inbox'}
              size={18}
              color={isSelected ? activeTheme.primary : activeTheme.text.secondary}
            />
          </View>

          {/* Contenu textuel */}
          <View style={styles.itemTextContainer}>
            {/* Nom principal */}
            <Text style={[styles.itemName, isSelected && styles.itemNameSelected]} numberOfLines={2}>
              {item.name}
            </Text>

            {/* Description si disponible */}
            {item.description && (
              <Text 
                style={[styles.itemDescription, isSelected && styles.itemDescriptionSelected]} 
                numberOfLines={2}
              >
                {item.description}
              </Text>
            )}

            {/* Métadonnées organisées */}
            <View style={styles.itemMetaRow}>
              {/* Conteneur pour les articles */}
              {item.type === 'item' && (
                <View style={styles.itemMetaItem}>
                  <Icon name="inbox" size={11} color={activeTheme.text.secondary} style={styles.itemMetaIcon} />
                  <Text style={[styles.itemContainerName, isSelected && styles.itemContainerNameSelected]}>
                    {staticData?.containers?.find(c => c.id === (item as Item).containerId)?.name || 'Aucun conteneur'}
                  </Text>
                </View>
              )}
              
              {/* Numéro pour les conteneurs */}
              {item.type === 'container' && (item as Container).number && (
                <View style={styles.itemMetaItem}>
                  <Icon name="tag" size={11} color={activeTheme.text.secondary} style={styles.itemMetaIcon} />
                  <Text style={[styles.itemContainerName, isSelected && styles.itemContainerNameSelected]}>
                    N° {(item as Container).number}
                  </Text>
                </View>
              )}

              {/* Prix pour les articles */}
              {item.type === 'item' && typeof (item as Item).sellingPrice === 'number' && (
                <View style={styles.itemMetaItem}>
                  <Icon name="euro" size={11} color={activeTheme.success || '#4CAF50'} style={styles.itemMetaIcon} />
                  <Text style={[styles.itemPrice, isSelected && styles.itemPriceSelected]}>
                    {(item as Item).sellingPrice?.toFixed(2)} €
                  </Text>
                </View>
              )}

              {/* Statut pour les articles */}
              {item.type === 'item' && (
                <View style={styles.itemMetaItem}>
                  <Text style={[
                    styles.itemStatus,
                    (item as Item).status === 'available' && styles.itemStatusAvailable,
                    (item as Item).status === 'sold' && styles.itemStatusSold
                  ]}>
                    {(item as Item).status === 'available' ? 'Disponible' : 'Vendu'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Checkbox avec design amélioré */}
          <View style={[styles.checkboxContainer, isSelected && styles.checkboxContainerSelected]}>
            <Icon
              name={isSelected ? "check_circle" : "radio_button_unchecked"}
              size={22}
              color={isSelected ? activeTheme.primary : activeTheme.text.secondary}
            />
          </View>
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
      <SafeAreaView style={[
        styles.safeArea, 
        Platform.OS === 'web' ? { paddingTop: 0 } : {}
      ]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={activeTheme.primary} />
          <Text style={styles.loadingText}>Chargement des données...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[
      styles.safeArea, 
      Platform.OS === 'web' ? { paddingTop: 0 } : {}
    ]}>
      <View style={styles.container}>
        {/* ✅ COMMONHEADER - Header standardisé */}
        <CommonHeader 
          title="Générateur d'Étiquettes"
          onBackPress={() => router.back()}
        />

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
                  menuPortalTarget={Platform.OS === 'web' ? document.body : undefined} 
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
                  menuPortalTarget={Platform.OS === 'web' ? document.body : undefined} 
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
  const router = useRouter();
  const userPermissions = useUserPermissions();
  const { activeTheme } = useAppTheme();

  // Vérifier les permissions
  useEffect(() => {
    if (!userPermissions.canViewLabels) {
      router.replace('/(tabs)/stock');
      return;
    }
  }, [userPermissions.canViewLabels, router]);

  // Si pas de permission, ne pas rendre le contenu
  if (!userPermissions.canViewLabels) {
    return (
      <View style={{ flex: 1, backgroundColor: activeTheme.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: activeTheme.text.primary, fontSize: 16 }}>
          Accès non autorisé - Permission requise pour accéder aux étiquettes
        </Text>
      </View>
    );
  }

  return <LabelScreenContent />;
};

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