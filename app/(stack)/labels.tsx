import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  TextInput,
  ScrollView,
  Switch
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LabelGenerator } from '../../src/components/LabelGenerator';
import type { Item } from '../../src/types/item';
import type { Container } from '../../src/types/container';
import type { Category } from '../../src/types/category';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { database } from '../../src/database/database';
import * as Sentry from '@sentry/react-native';

// Algolia imports
import { InstantSearch, useSearchBox, useHits, useInstantSearch, Configure, useRefinementList, useToggleRefinement } from 'react-instantsearch-hooks-web';
import { searchClient, INDEX_NAME, algoliaConfig } from '../../src/config/algolia';

interface Filters {
  categoryId: number | null;
  containerId: number | null;
  minPrice: string;
  maxPrice: string;
  startDate: Date | null;
  endDate: Date | null;
  status: 'all' | 'available' | 'sold';
}

interface InventoryData {
  items: Item[];
  categories: Category[];
  containers: Container[];
}

type ListItemFromAlgolia = Item | Container;

const QUERY_KEYS = {
  allData: 'allData'
} as const;

const CACHE_CONFIG = {
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  retry: 3,
} as const;

const LabelScreenContent = () => {
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectedContainers, setSelectedContainers] = useState<Set<number>>(new Set());
  const [showContainers, setShowContainers] = useState(false);
  const [showAlgoliaFilters, setShowAlgoliaFilters] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);
  
  const [filters, setFilters] = useState<Filters>({
    categoryId: null,
    containerId: null,
    minPrice: '',
    maxPrice: '',
    startDate: null,
    endDate: null,
    status: 'all'
  });

  const prevFiltersRef = useRef<Filters>(filters);
  useEffect(() => {
    const prevFilters = prevFiltersRef.current;
    const changedProps = Object.entries(filters).filter(
      ([key, value]) => prevFilters[key as keyof Filters] !== value
    );
    if (changedProps.length > 0) {
      prevFiltersRef.current = { ...filters };
    }
  }, [filters]);

  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const isSearchActive = !!searchQuery;

  // --- LOGIQUE ALGOLIA UNIQUEMENT SI RECHERCHE ACTIVE ---
  let algoliaResults: any[] = [];
  let refreshAlgolia = () => {};
  let algoliaStatus = '';
  let hits: any[] = [];
  if (isSearchActive) {
    // Monter InstantSearch et hooks Algolia uniquement si recherche active
    // Utiliser useInstantSearch, useHits, etc.
    const algolia = useInstantSearch();
    // algoliaResults = algolia.results; // Supprimé car SearchResults<any> n'est pas un tableau et n'est pas utilisé comme tel
    refreshAlgolia = algolia.refresh;
    algoliaStatus = algolia.status;
    hits = (useHits().hits as any[]);
  }

  const { 
    data: staticData,
    isLoading: isLoadingStaticData, 
    error: errorStaticData 
  } = useQuery<InventoryData, Error>({
    queryKey: [QUERY_KEYS.allData],
    queryFn: async () => {
      try {
        const [categoriesData, containersDataFromDB] = await Promise.all([
          database.getCategories(),
          database.getContainers()
        ]);
        return {
          items: [],
          categories: categoriesData || [],
          containers: containersDataFromDB || []
        };
      } catch (error) {
        if (error instanceof Error) {
          Sentry.captureException(error, { tags: { type: 'labels_static_data_fetch_error' } });
        }
        throw error;
      }
    },
    ...CACHE_CONFIG
  });

  const displayedListFromAlgolia = useMemo(() => {
    // DEBUG: Indiquer le type de filtre appliqué
    console.log("LABELS DEBUG - Filtre appliqué:", showContainers ? "container" : "item");
    console.log("LABELS DEBUG - Total hits Algolia:", (hits as any[]).length);
    
    const filteredHits = (hits as any[]).filter((hit: any) => {
      // DEBUG: Log détaillé du filtrage
      if (hit.doc_type === undefined) {
        console.log("LABELS DEBUG - Hit sans doc_type:", hit.objectID);
      }
      return hit.doc_type === (showContainers ? 'container' : 'item');
    });
    
    // DEBUG: Log des résultats du filtrage
    console.log("LABELS DEBUG - Résultats filtrés:", filteredHits.length);

    // Ensuite on mappe comme avant
    const result = filteredHits.map((hit: any) => {
      // Fonction de parsing sécurisé des dates
      const parseDateSafe = (dateString: string | null | undefined) => {
        if (!dateString) return new Date().toISOString();
        try {
          // Parse la date au format PostgreSQL "2025-05-09 16:13:28.294+00"
          return new Date(dateString).toISOString();
        } catch (error) {
          console.log("LABELS DEBUG - Erreur de parsing de date:", dateString);
          return new Date().toISOString();
        }
      };

      const commonMappedFields = {
        id: Number(hit.objectID),
        name: hit.name || '',
        description: hit.description || '',
        qrCode: hit.qr_code || null,
        createdAt: parseDateSafe(hit.created_at),
        updatedAt: parseDateSafe(hit.updated_at),
        photoStorageUrl: hit.photo_storage_url || null, 
      };

      if (showContainers) {
        return {
          ...commonMappedFields,
          number: hit.number?.toString() || '',
        } as Container;
      } else {
        return {
          ...commonMappedFields,
          sellingPrice: typeof hit.selling_price === 'string' ? parseFloat(hit.selling_price) : (typeof hit.selling_price === 'number' ? hit.selling_price : 0),
          purchasePrice: typeof hit.purchase_price === 'string' ? parseFloat(hit.purchase_price) : (typeof hit.purchase_price === 'number' ? hit.purchase_price : 0),
          categoryId: hit.category_id ? Number(hit.category_id) : null,
          categoryName: hit.category_name || '',
          containerId: hit.container_id ? Number(hit.container_id) : null,
          status: (hit.status || 'available') as 'available' | 'sold',
        } as Item;
      }
    });

    console.log("LABELS DEBUG - Liste finale après mapping:", result.length);
    return result;
  }, [hits, showContainers]);

  // DEBUG: Vérifier la liste finale après mapping
  if (displayedListFromAlgolia.length > 0) {
    console.log("LABELS DEBUG - Premier élément mappé:", JSON.stringify(displayedListFromAlgolia[0]));
  }

  const stableCallbacks = useRef({
    handleCategoryChange: (categoryId: number | undefined) => {
      setFilters(prev => ({ ...prev, categoryId: categoryId || null, containerId: null }));
    },
    handleContainerChange: (containerId: number | 'none' | undefined) => {
      const newContainerId = containerId === 'none' ? null : containerId || null;
      setFilters(prev => ({ ...prev, containerId: newContainerId, categoryId: null }));
    },
    handleStatusChange: (status: 'all' | 'available' | 'sold') => {
      setFilters(prev => ({ ...prev, status }));
    },
    handlePriceChange: (min: number | undefined, max: number | undefined) => {
      const minStr = min?.toString() || '';
      const maxStr = max?.toString() || '';
      setFilters(prev => ({ ...prev, minPrice: minStr, maxPrice: maxStr }));
    },
    handleToggleItem: (itemId: number) => {
      if (showContainers) {
        console.log("LABELS DEBUG - handleToggleItem (Containers) - ID clicked:", itemId);
        setSelectedContainers(prev => {
          const newSelected = new Set(prev);
          const isCurrentlySelected = newSelected.has(itemId);
          if (isCurrentlySelected) {
            newSelected.delete(itemId);
            console.log("LABELS DEBUG - handleToggleItem (Containers) - Désélection de l'ID:", itemId);
          } else {
            newSelected.add(itemId);
            console.log("LABELS DEBUG - handleToggleItem (Containers) - Sélection de l'ID:", itemId);
          }
          console.log("LABELS DEBUG - handleToggleItem (Containers) - Nouveau state selectedContainers (size):", newSelected.size);
          return newSelected;
        });
      } else {
        setSelectedItems(prev => {
          const newSelected = new Set(prev);
          if (newSelected.has(itemId)) newSelected.delete(itemId); else newSelected.add(itemId);
          return newSelected;
        });
      }
    },
    handleDeselectAll: () => {
      if (showContainers) {
        setSelectedContainers(new Set());
        console.log("LABELS - Désélection de tous les containers");
      } else {
        setSelectedItems(new Set());
        console.log("LABELS - Désélection de tous les items");
      }
    },
    handleDateChange: (_event: any, selectedDate: Date | null | undefined) => {
      if (Platform.OS === 'android') setShowDatePicker(null);
      if (selectedDate) {
        setFilters(prev => ({ ...prev, [showDatePicker === 'start' ? 'startDate' : 'endDate']: selectedDate }));
      } else if (selectedDate === null) {
        setFilters(prev => ({ ...prev, [showDatePicker === 'start' ? 'startDate' : 'endDate']: null }));
      }
    },
    handleResetDate: (type: 'start' | 'end') => {
      setFilters(prev => ({ ...prev, [type === 'start' ? 'startDate' : 'endDate']: null }));
    },
  }).current;

  // Définir la fonction handleToggleItem en dehors du useRef
  const handleToggleItem = useCallback((itemId: number) => {
    if (showContainers) {
      console.log("LABELS DEBUG - handleToggleItem (Containers) - ID clicked:", itemId);
      setSelectedContainers(prev => {
        const newSelected = new Set(prev);
        const isCurrentlySelected = newSelected.has(itemId);
        if (isCurrentlySelected) {
          newSelected.delete(itemId);
          console.log("LABELS DEBUG - handleToggleItem (Containers) - Désélection de l'ID:", itemId);
        } else {
          newSelected.add(itemId);
          console.log("LABELS DEBUG - handleToggleItem (Containers) - Sélection de l'ID:", itemId);
        }
        console.log("LABELS DEBUG - handleToggleItem (Containers) - Nouveau state selectedContainers (size):", newSelected.size);
        return newSelected;
      });
    } else {
      setSelectedItems(prev => {
        const newSelected = new Set(prev);
        if (newSelected.has(itemId)) newSelected.delete(itemId); else newSelected.add(itemId);
        return newSelected;
      });
    }
  }, [showContainers, setSelectedContainers, setSelectedItems]);

  // Définir la fonction handleSelectAll en dehors du useRef pour avoir accès aux dernières valeurs de hits
  const handleSelectAll = useCallback(() => {
    // Debug pour vérifier les hits disponibles
    console.log("LABELS DEBUG - Nombre de hits disponibles:", (hits as any[]).length);
    
    if (showContainers) {
      // Filtre pour containers
      const allContainers = (hits as any[])
        .filter((hit: any) => hit.doc_type === 'container' && hit.objectID)
        .map((hit: any) => Number(hit.objectID));
      
      console.log("LABELS DEBUG - Total containers trouvés:", allContainers.length);
      
      if (allContainers.length > 0) {
        const newSelected = new Set(allContainers);
        setSelectedContainers(newSelected);
        console.log("LABELS - Sélection de tous les containers:", newSelected.size);
      }
    } else {
      // Debuggons les valeurs doc_type pour comprendre le problème
      console.log("LABELS DEBUG - 5 premiers hits:", (hits as any[]).slice(0, 5));
      
      // Utiliser une condition plus souple pour identifier les items
      const allItems = (hits as any[])
        .filter((hit: any) => {
          const isItem = hit.doc_type !== 'container';
          return isItem && hit.objectID;
        })
        .map((hit: any) => Number(hit.objectID));
      
      console.log("LABELS DEBUG - Total items trouvés:", allItems.length);
      
      if (allItems.length > 0) {
        const newSelected = new Set(allItems);
        setSelectedItems(newSelected);
        console.log("LABELS - Sélection de tous les items:", newSelected.size);
      }
    }
  }, [hits, showContainers, setSelectedItems, setSelectedContainers]);

  const handleDeselectAll = useCallback(() => {
    stableCallbacks.handleDeselectAll();
  }, [stableCallbacks]);

  const webDateInputStyle: React.CSSProperties = {
    flex: 1,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#333',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    outline: 'none',
    minWidth: '120px',
  };

  useEffect(() => {
    if (showContainers) setSelectedItems(new Set()); else setSelectedContainers(new Set());
  }, [showContainers]);

  const getItemsToGenerate = () => {
    const listToUse = displayedListFromAlgolia;
    if (showContainers) {
      return listToUse
        .filter(container => selectedContainers.has((container as Container).id!))
        .map(c => {
          const container = c as Container;
          return {
          id: container.id!,
          name: container.name,
          description: container.description,
          number: container.number?.toString() || '',
          qrCode: container.qrCode || `CONT_${container.id.toString().padStart(4, '0')}`
          };
        }) || [];
    }
    return listToUse
      .filter(item => selectedItems.has((item as Item).id!))
      .map(i => {
        const item = i as Item;
        return {
        id: item.id!,
        name: item.name,
        description: item.description,
        sellingPrice: item.sellingPrice,
        qrCode: item.qrCode || `ART_${item.id.toString().padStart(4, '0')}`
        };
      });
  };

  // État pour suivre si le composant web est monté
  const isWebComponentMounted = Platform.OS === 'web' ? true : false;

  // --- CHARGEMENT SUPABASE PAR DÉFAUT ---
  const {
    data: supabaseData,
    isLoading: isLoadingSupabase,
    error: errorSupabase
  } = useQuery<InventoryData, Error>({
    queryKey: ['labels_supabase', filters, searchQuery],
    queryFn: async () => {
      if (searchQuery) return { items: [], categories: [], containers: [] }; // On laisse Algolia gérer
      try {
        const [categoriesData, containersData, allItems] = await Promise.all([
          database.getCategories(),
          database.getContainers(),
          database.getItems()
        ]);
        // Filtres locaux
        let filteredItems = allItems;
        if (filters.categoryId) filteredItems = filteredItems.filter(i => i.categoryId === filters.categoryId);
        if (filters.containerId) filteredItems = filteredItems.filter(i => i.containerId === filters.containerId);
        if (filters.status && filters.status !== 'all') filteredItems = filteredItems.filter(i => i.status === filters.status);
        // TODO: Ajouter filtres prix/dates si besoin
        return {
          items: filteredItems,
          categories: categoriesData || [],
          containers: containersData || []
        };
      } catch (error) {
        if (error instanceof Error) {
          Sentry.captureException(error, { tags: { type: 'labels_supabase_fetch_error' } });
        }
        throw error;
      }
    },
    ...CACHE_CONFIG
  });

  // --- LOGIQUE DE SÉLECTION DE LA SOURCE DE DONNÉES ---
  const itemsToDisplay = isSearchActive ? displayedListFromAlgolia : (supabaseData?.items || []);
  const containersToDisplay = isSearchActive ? displayedListFromAlgolia : (supabaseData?.containers || []);
  const isLoading = isSearchActive ? (isLoadingStaticData || algoliaStatus === 'loading' || algoliaStatus === 'stalled') : isLoadingSupabase;
  const errorToDisplay = isSearchActive ? errorStaticData : errorSupabase;

  // --- SEARCHBOX ADAPTÉE ---
  const SearchBox = () => (
    <View style={styles.searchBoxContainer}>
      <TextInput
        style={styles.searchBoxInput}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={Platform.OS === 'web' ? "Rechercher articles/containers..." : "Rechercher..."}
        placeholderTextColor="#999"
        clearButtonMode="always"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );

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
          <MaterialIcons name="shopping-bag" size={20} color={!showContainers ? '#007AFF' : '#666'} style={styles.segmentIcon} />
          <Text style={[styles.segmentButtonText, !showContainers && styles.segmentButtonTextActive]}>
            Articles ({showContainers ? 0 : selectedItems.size})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentButton, showContainers && styles.segmentButtonActive]}
          onPress={() => setShowContainers(true)}
        >
          <MaterialIcons name="inbox" size={20} color={showContainers ? '#007AFF' : '#666'} style={styles.segmentIcon} />
          <Text style={[styles.segmentButtonText, showContainers && styles.segmentButtonTextActive]}>
            Containers ({showContainers ? selectedContainers.size : 0})
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterSection}>
        <SearchBox />
        {isSearchActive && (
          <TouchableOpacity style={styles.filtersToggleHeaderAlgolia} onPress={() => setShowAlgoliaFilters(!showAlgoliaFilters)}>
            <Text style={styles.filtersToggleHeaderTextAlgolia}>Filtrer par attributs</Text>
          </TouchableOpacity>
        )}
        {isSearchActive && showAlgoliaFilters && (
          <View style={styles.filtersContainerAlgolia}>
            <RefinementListFilter attribute="category_name" title="Catégorie" />
            <RefinementListFilter attribute="container_reference" title="Container" />
            <RefinementListFilter attribute="status" title="Disponibilité" />
          </View>
        )}
        <View style={styles.dateFilters}>
          {Platform.OS === 'web' && isWebComponentMounted ? (
            <>
              <View style={[styles.dateButton, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e9ecef' }]}>
                <MaterialIcons name="calendar-today" size={20} color="#007AFF" />
                <input
                  type="date"
                  style={webDateInputStyle}
                  value={filters.startDate ? format(filters.startDate, 'yyyy-MM-dd') : ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    const date = value ? new Date(value + "T00:00:00.000Z") : null;
                    stableCallbacks.handleDateChange(e, date);
                  }}
                  placeholder="Date début"
                />
                {filters.startDate && (
                  <TouchableOpacity onPress={() => stableCallbacks.handleResetDate('start')}>
                    <MaterialIcons name="close" size={20} color="#666" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={[styles.dateButton, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e9ecef' }]}>
                <MaterialIcons name="calendar-today" size={20} color="#007AFF" />
                <input
                  type="date"
                  style={webDateInputStyle}
                  value={filters.endDate ? format(filters.endDate, 'yyyy-MM-dd') : ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    let date = null;
                    if (value) {
                      date = new Date(value + "T00:00:00.000Z");
                      date.setUTCHours(23, 59, 59, 999);
                    }
                    stableCallbacks.handleDateChange(e, date);
                  }}
                  placeholder="Date fin"
                />
                {filters.endDate && (
                  <TouchableOpacity onPress={() => stableCallbacks.handleResetDate('end')}>
                    <MaterialIcons name="close" size={20} color="#666" />
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker('start')}> 
                <MaterialIcons name="calendar-today" size={20} color="#666" />
                <Text style={styles.dateButtonText}>{filters.startDate ? format(filters.startDate, 'dd/MM/yyyy', { locale: fr }) : 'Date début'}</Text>
                {filters.startDate && <TouchableOpacity onPress={() => stableCallbacks.handleResetDate('start')} style={{ padding: 4 }}><MaterialIcons name="close" size={20} color="#666" /></TouchableOpacity>}
                  </TouchableOpacity>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker('end')}>
                <MaterialIcons name="calendar-today" size={20} color="#666" />
                <Text style={styles.dateButtonText}>{filters.endDate ? format(filters.endDate, 'dd/MM/yyyy', { locale: fr }) : 'Date fin'}</Text>
                {filters.endDate && <TouchableOpacity onPress={() => stableCallbacks.handleResetDate('end')} style={{ padding: 4 }}><MaterialIcons name="close" size={20} color="#666" /></TouchableOpacity>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <View style={styles.selectionHeader}>
        <Text style={styles.sectionTitle}>
          {showContainers ? 'Containers' : 'Articles'} sélectionnés ({showContainers ? selectedContainers.size : selectedItems.size})
        </Text>
        <View style={styles.selectionActions}>
          <TouchableOpacity style={styles.selectionButton} onPress={handleSelectAll}>
            <MaterialIcons name="check-box" size={18} color="#007AFF" />
            <Text style={styles.selectionButtonText}>Tout sélectionner</Text>
          </TouchableOpacity>
          <Text style={styles.selectionSeparator}>•</Text>
          <TouchableOpacity style={styles.selectionButton} onPress={handleDeselectAll}>
            <MaterialIcons name="check-box-outline-blank" size={18} color="#FF3B30" />
            <Text style={[styles.selectionButtonText, styles.deselectButtonText]}>Tout désélectionner</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.selectionSection}
        contentContainerStyle={styles.itemListContent}
      >
        {(showContainers ? containersToDisplay : itemsToDisplay).map((item, index) => (
          <TouchableOpacity
            key={item.id?.toString() || index}
            style={[
              styles.itemRow,
              (showContainers ? selectedContainers : selectedItems).has(item.id!) && styles.itemRowSelected
            ]}
            onPress={() => {
              console.log("LABELS DEBUG - TouchableOpacity pressed for ID:", item.id!);
              handleToggleItem(item.id!);
            }}
          >
            <View style={styles.itemInfo}>
              <Text style={[
                styles.itemName,
                (showContainers ? selectedContainers : selectedItems).has(item.id!) && styles.itemNameSelected
              ]}>
                {item.name}
                {__DEV__ && <Text style={{ fontSize: 10, color: '#999' }}> (#{index})</Text>}
              </Text>
              {!showContainers && (item as Item).containerId && (
                <Text style={styles.itemContainer}>
                  {containersToDisplay?.find(c => c.id === (item as Item).containerId)?.name || 'Sans container'}
                </Text>
              )}
            </View>
            <MaterialIcons
              name={(showContainers ? selectedContainers : selectedItems).has(item.id!) ? "check-circle" : "radio-button-unchecked"}
              size={22}
              color={(showContainers ? selectedContainers : selectedItems).has(item.id!) ? "#007AFF" : "#CCC"}
            />
          </TouchableOpacity>
        ))}
        {(showContainers ? containersToDisplay : itemsToDisplay).length === 0 && !isLoading && algoliaResults && (
          <View style={styles.noResultsContainer}>
            <Text style={styles.noResultsText}>
              {`Aucun ${showContainers ? 'container' : 'article'} trouvé.`}
            </Text>
          </View>
        )}
      </ScrollView>

      {((showContainers ? selectedContainers.size : selectedItems.size) > 0) && (
        <View style={styles.generatorContainer}>
          <LabelGenerator
            items={getItemsToGenerate()}
            onComplete={() => {
              if (showContainers) setSelectedContainers(new Set()); else setSelectedItems(new Set());
              router.replace('/(stack)/settings');
            }}
            onError={(error) => {
              console.error(error);
              Alert.alert('Erreur', 'Une erreur est survenue lors de la génération des étiquettes');
            }}
            mode={showContainers ? 'containers' : 'items'}
            compact={true}
          />
        </View>
      )}

      {showDatePicker && Platform.OS !== 'web' && (
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
            value={showDatePicker === 'start' ? filters.startDate || new Date() : filters.endDate || new Date()}
            mode="date"
            display="spinner"
            onChange={stableCallbacks.handleDateChange}
            textColor="#000"
          />
          <TouchableOpacity
            style={styles.closeDatePickerButton}
            onPress={() => setShowDatePicker(null)}
          >
            <Text style={styles.closeDatePickerButtonText}>Fermer</Text>
          </TouchableOpacity>
        </BlurView>
      )}
    </View>
  );
}

export default function LabelScreen() {
  // Monter InstantSearch uniquement si recherche active
  const [searchQuery, setSearchQuery] = useState('');
  const isSearchActive = !!searchQuery;
  if (isSearchActive) {
    return (
      <InstantSearch searchClient={searchClient} indexName={INDEX_NAME}>
        <Configure {...{ hitsPerPage: 1000 } as any} />
        <LabelScreenContent />
      </InstantSearch>
    );
  }
  return <LabelScreenContent />;
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
  filterSection: {
    padding: 16,
    paddingTop: 8,
    position: 'relative',
  },
  selectionSection: {
    flex: 1,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  selectionHeader: {
    flexDirection: 'column',
    padding: 16,
    paddingBottom: 12,
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
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
  itemListContent: {
    padding: 8,
    paddingTop: 0,
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
  itemInfo: { flex: 1, marginRight: 12 },
  itemName: { fontSize: 16, marginBottom: 4, color: '#212529', fontWeight: '500' },
  itemNameSelected: { color: '#007AFF' },
  itemContainer: { fontSize: 14, color: '#666' },
  segmentIcon: { marginRight: 6 },
  segmentButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 8, borderRadius: 6 },
  segmentButtonActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  segmentButtonText: { fontSize: 15, color: '#666' },
  segmentButtonTextActive: { color: '#007AFF', fontWeight: '600' },
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
  searchBoxContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
  },
  searchBoxInput: {
    backgroundColor: '#fff',
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ced4da',
    color: '#333',
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  filtersToggleHeaderAlgolia: {
    padding: Platform.OS === 'web' ? 12 : 8,
    backgroundColor: Platform.OS === 'web' ? '#fff' : '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 0,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  filtersToggleHeaderTextAlgolia: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  filtersContainerAlgolia: {
    paddingVertical: 8,
    paddingHorizontal: Platform.OS === 'web' ? 0 : 0,
    backgroundColor: Platform.OS === 'web' ? 'transparent' : 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterSectionAlgolia: {
    marginBottom: 8,
  },
  filterTitleAlgolia: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  filterOptionsContainerAlgolia: {
    paddingVertical: 4,
  },
  filterButtonAlgolia: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterButtonActiveAlgolia: {
    backgroundColor: '#007AFF',
    borderColor: '#005ecb',
  },
  filterButtonTextAlgolia: {
    fontSize: 13,
    color: '#333',
  },
  filterButtonTextActiveAlgolia: {
    color: '#fff',
    fontWeight: '500',
  },
  toggleFilterContainerAlgolia: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 8,
  },
});

function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };
  return debounced as (...args: Parameters<F>) => ReturnType<F>;
}

const AlgoliaSearchBox = () => {
  const { query, refine } = useSearchBox();
  const [inputValue, setInputValue] = useState(query);
  const inputRef = useRef<TextInput>(null);

  const debouncedRefine = useCallback(
    debounce((newQuery: string) => {
      refine(newQuery);
    }, 300),
    [refine]
  );

  const onChangeText = (newQuery: string) => {
    setInputValue(newQuery);
    debouncedRefine(newQuery);
  };
  
  useEffect(() => {
    if (query !== inputValue) {
      setInputValue(query);
    }
  }, [query]);

  return (
    <View style={styles.searchBoxContainer}>
      <TextInput
        ref={inputRef}
        style={styles.searchBoxInput}
        value={inputValue}
        onChangeText={onChangeText}
        placeholder={Platform.OS === 'web' ? "Rechercher articles/containers..." : "Rechercher..."}
        placeholderTextColor="#999"
        clearButtonMode="always"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
};

const RefinementListFilter = ({ attribute, title }: { attribute: string; title: string }) => {
  const { items, refine, canRefine } = useRefinementList({ attribute });

  useEffect(() => {
    console.log(`[RefinementListFilter] ${title} - canRefine: ${canRefine}, items:`, items);
  }, [canRefine, items, title]);

  if (!canRefine) {
    return null;
  }

  return (
    <View style={styles.filterSectionAlgolia}>
      <Text style={styles.filterTitleAlgolia}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterOptionsContainerAlgolia}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.value}
            style={[styles.filterButtonAlgolia, item.isRefined && styles.filterButtonActiveAlgolia]}
            onPress={() => refine(item.value)}
          >
            <Text style={[styles.filterButtonTextAlgolia, item.isRefined && styles.filterButtonTextActiveAlgolia]}>
              {item.label} ({item.count})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const PriceMatchFilter = ({ attribute, title }: { attribute: string; title: string }) => {
  const { value, refine, canRefine } = useToggleRefinement({ attribute, on: true });

  if (!canRefine) {
    return null;
  }

  return (
    <View style={[styles.filterSectionAlgolia, styles.toggleFilterContainerAlgolia]}>
      <Text style={styles.filterTitleAlgolia}>{title}</Text>
      <Switch
        value={value.isRefined}
        onValueChange={() => refine({ isRefined: !value.isRefined })}
        trackColor={{ false: "#767577", true: "#81b0ff" }}
        thumbColor={value.isRefined ? "#007AFF" : "#f4f3f4"}
        ios_backgroundColor="#3e3e3e"
      />
    </View>
  );
};