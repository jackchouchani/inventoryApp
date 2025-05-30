import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  TextInput,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Image
} from 'react-native';
import { Icon } from '../../src/components';
import { useRouter } from 'expo-router';
import { searchItems, SearchFilters } from '../../src/services/searchService';
import { ReceiptGenerator } from '../../src/components/ReceiptGenerator';
import { getImageUrl } from '../../src/utils/r2Client';
import { formatCurrency } from '../../src/utils/format';
import { supabase } from '../../src/config/supabase';
import { useAppTheme, type AppThemeType } from '../../src/contexts/ThemeContext';

// Types
import type { Item } from '../../src/types/item';

// Define type for items with added properties for receipt generation
interface ReceiptItem extends Item {
  actualSellingPrice?: number;
  quantity?: number;
}

// Component for searching and selecting items
const SearchBox = ({ query, setQuery, theme }: { query: string; setQuery: (q: string) => void; theme: AppThemeType }) => {
  const styles = useMemo(() => getThemedStyles(theme), [theme]);
  
  return (
    <View style={styles.searchBoxContainer}>
      <Icon name="search" size={20} color={theme.text.secondary} style={styles.searchIcon} />
      <TextInput
        style={styles.searchBoxInput}
        value={query}
        onChangeText={setQuery}
        placeholder="Rechercher des articles..."
        placeholderTextColor={theme.text.secondary}
        clearButtonMode="always"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {query.length > 0 && (
        <TouchableOpacity onPress={() => setQuery('')} style={styles.clearButton}>
          <Icon name="clear" size={20} color={theme.text.secondary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const MultiReceiptScreen = () => {
  const router = useRouter();
  const { activeTheme } = useAppTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<Map<number, ReceiptItem>>(new Map());
  const [searchResults, setSearchResults] = useState<ReceiptItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showReceiptGenerator, setShowReceiptGenerator] = useState(false);
  const [itemsForReceipt, setItemsForReceipt] = useState<ReceiptItem[]>([]);
  const [totalDiscount, setTotalDiscount] = useState<number>(0);
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [showMarkAsSoldConfirmation, setShowMarkAsSoldConfirmation] = useState(false);
  const [isUpdatingItems, setIsUpdatingItems] = useState(false);
  
  const styles = useMemo(() => getThemedStyles(activeTheme), [activeTheme]);
  
  // Function to search for items using Supabase
  const searchItemsCallback = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsLoading(true);
    try {
      // Utiliser le service de recherche Supabase
      const filters: SearchFilters = {
        search: query,
        status: 'available', // Afficher uniquement les articles disponibles
        pageSize: 20
      };
      
      const result = await searchItems(filters);
      
      // Convertir les résultats au format ReceiptItem
      const formattedResults = result.items.map(item => ({
        ...item,
        actualSellingPrice: item.sellingPrice
      })) as ReceiptItem[];
      
      setSearchResults(formattedResults);
    } catch (error) {
      console.error('Error searching items:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la recherche');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Search when query changes
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      searchItemsCallback(searchQuery);
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, searchItemsCallback]);

  // Toggle item selection
  const toggleItemSelection = (item: Item) => {
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      if (newMap.has(item.id)) {
        newMap.delete(item.id);
      } else {
        // Set actualSellingPrice to the default selling price when adding
        newMap.set(item.id, { ...item, actualSellingPrice: item.sellingPrice });
      }
      return newMap;
    });
  };

  // Update item price
  const updateItemPrice = (itemId: number, price: number) => {
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      const item = newMap.get(itemId);
      if (item) {
        newMap.set(itemId, { ...item, actualSellingPrice: price });
      }
      return newMap;
    });
  };

  // Calculate total price of selected items
  const calculateTotal = useCallback(() => {
    return Array.from(selectedItems.values()).reduce((total, item) => {
      const price = item.actualSellingPrice || item.sellingPrice || 0;
      return total + price;
    }, 0);
  }, [selectedItems]);

  // Apply discount to total
  const applyTotalDiscount = (percentage: number) => {
    if (percentage < 0 || percentage > 100) {
      Alert.alert('Erreur', 'Le pourcentage de remise doit être entre 0 et 100');
      return;
    }

    const total = calculateTotal();
    const discount = (percentage / 100) * total;
    setTotalDiscount(discount);
    setDiscountPercentage(percentage);
  };
  
  // Handle receipt generation
  const handleGenerateReceipt = () => {
    if (selectedItems.size === 0) {
      Alert.alert('Attention', 'Veuillez sélectionner au moins un article');
      return;
    }
    
    // Apply total discount to each item proportionally if needed
    let items = Array.from(selectedItems.values());
    if (totalDiscount > 0) {
      const total = calculateTotal();
      items = items.map(item => {
        const price = item.actualSellingPrice || item.sellingPrice || 0;
        // Calculate item's proportion of the total
        const proportion = price / total;
        // Calculate this item's share of the discount
        const itemDiscount = totalDiscount * proportion;
        // Apply the discount
        return {
          ...item,
          actualSellingPrice: price - itemDiscount
        };
      });
    }
    
    setItemsForReceipt(items);
    setShowReceiptGenerator(true);
  };

  // Handle receipt completion
  const handleReceiptComplete = () => {
    setShowReceiptGenerator(false);
    
    // Demander à l'utilisateur s'il souhaite marquer les articles comme vendus
    setShowMarkAsSoldConfirmation(true);
  };

  // Handle receipt error
  const handleReceiptError = (error: Error) => {
    Alert.alert('Erreur', `Erreur lors de la génération de la facture: ${error.message}`);
    setShowReceiptGenerator(false);
  };
  
  // Marquer les articles comme vendus dans Supabase
  const markItemsAsSold = async () => {
    if (itemsForReceipt.length === 0) return;
    
    setIsUpdatingItems(true);
    try {
      // Traiter chaque article un par un pour mettre à jour son statut et son prix de vente
      const updatePromises = itemsForReceipt.map(async (item) => {
        // Obtenir le prix de vente réel (possiblement modifié par l'utilisateur)
        const actualSalePrice = item.actualSellingPrice ?? item.sellingPrice ?? 0;
        
        // Mettre à jour l'article dans Supabase
        const { error } = await supabase
          .from('items')
          .update({
            status: 'sold',
            selling_price: actualSalePrice,
            sold_at: new Date().toISOString() // Enregistrer la date de vente
          })
          .eq('id', item.id);
          
        if (error) {
          console.error(`Erreur lors de la mise à jour de l'article ${item.id}:`, error);
          throw error;
        }
      });
      
      // Attendre que toutes les mises à jour soient terminées
      await Promise.all(updatePromises);
      
      // Notification de succès
      Alert.alert(
        'Succès', 
        `${itemsForReceipt.length} article(s) marqué(s) comme vendu(s) avec succès`
      );
      
      // Vider la sélection puisque les articles sont maintenant vendus
      setSelectedItems(new Map());
      setItemsForReceipt([]);
      
    } catch (error) {
      console.error('Erreur lors de la mise à jour des articles:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la mise à jour des articles');
    } finally {
      setIsUpdatingItems(false);
      setShowMarkAsSoldConfirmation(false);
    }
  };
  
  // Annuler le marquage comme vendu
  const cancelMarkAsSold = () => {
    setShowMarkAsSoldConfirmation(false);
  };

  // Confirmation pour marquer comme vendus ou non
  const renderMarkAsSoldConfirmation = () => {
    if (!showMarkAsSoldConfirmation) return null;
    
    return (
      <View style={styles.confirmationOverlay}>
        <View style={styles.confirmationDialog}>
          <Text style={styles.confirmationTitle}>Marquer comme vendus ?</Text>
          <Text style={styles.confirmationText}>
            Souhaitez-vous marquer tous les articles de cette facture comme vendus ?
          </Text>
          
          <View style={styles.confirmationButtons}>
            <TouchableOpacity 
              style={[styles.confirmationButton, styles.cancelButton]}
              onPress={cancelMarkAsSold}
              disabled={isUpdatingItems}
            >
              <Text style={styles.confirmationButtonText}>Non</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.confirmationButton, styles.confirmButton]}
              onPress={markItemsAsSold}
              disabled={isUpdatingItems}
            >
              {isUpdatingItems ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.confirmationButtonText}>Oui</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // Render item in search results
  const renderSearchItem = ({ item }: { item: Item }) => {
    const isSelected = selectedItems.has(item.id);
    
    return (
      <TouchableOpacity 
        style={[styles.searchResultItem, isSelected && styles.selectedItem]} 
        onPress={() => toggleItemSelection(item)}
      >
        <View style={styles.itemImageContainer}>
          {item.photo_storage_url ? (
            <Image 
              source={{ uri: getImageUrl(item.photo_storage_url) }} 
              style={styles.itemImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.noImagePlaceholder}>
              <Icon name="image_not_supported" size={24} color={activeTheme.text.secondary} />
            </View>
          )}
        </View>
        
        <View style={styles.itemDetails}>
          <Text style={styles.itemName}>{item.name}</Text>
          {item.description && (
            <Text style={styles.itemDescription} numberOfLines={1}>{item.description}</Text>
          )}
          <Text style={styles.itemPrice}>
            {item.sellingPrice ? formatCurrency(item.sellingPrice) : 'Prix non défini'}
          </Text>
        </View>
        
        <View style={styles.selectionIndicator}>
          {isSelected ? (
            <Icon name="check_circle" size={24} color={activeTheme.primary} />
          ) : (
            <Icon name="radio_button_unchecked" size={24} color={activeTheme.text.disabled} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render selected items
  const renderSelectedItem = (item: ReceiptItem) => {
    const actualPrice = item.actualSellingPrice !== undefined ? item.actualSellingPrice : item.sellingPrice;
    const hasDiscount = actualPrice < item.sellingPrice;
    
    return (
      <View key={item.id} style={styles.selectedItemCard}>
        <View style={styles.selectedItemHeader}>
          <Text style={styles.selectedItemName} numberOfLines={1}>{item.name}</Text>
          <TouchableOpacity onPress={() => toggleItemSelection(item)}>
            <Icon name="close" size={20} color={activeTheme.text.secondary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.priceControl}>
          <Text style={styles.priceLabel}>Prix:</Text>
          <TextInput
            style={styles.priceInput}
            value={actualPrice.toString()}
            onChangeText={(value) => {
              const price = parseFloat(value) || 0;
              updateItemPrice(item.id, price);
            }}
            keyboardType="numeric"
            placeholder={item.sellingPrice.toString()}
            placeholderTextColor={activeTheme.text.secondary}
          />
          <Text style={styles.priceUnit}>€</Text>
        </View>
        
        {hasDiscount && (
          <View style={styles.itemDiscountContainer}>
            <Text style={styles.itemDiscountText}>
              {formatCurrency(item.sellingPrice)} → {formatCurrency(actualPrice)}
              {` (-${((1 - actualPrice/item.sellingPrice) * 100).toFixed(0)}%)`}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Icon name="arrow_back" size={24} color={activeTheme.primary} />
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Facture Multiple</Text>
      </View>

      {showMarkAsSoldConfirmation && renderMarkAsSoldConfirmation()}

      {showReceiptGenerator ? (
        <ReceiptGenerator 
          items={itemsForReceipt.map(item => ({
            ...item,
            qrCode: item.qrCode || '', // Assurer que qrCode n'est jamais undefined
            quantity: item.quantity || 1
          }))}
          onComplete={handleReceiptComplete}
          onError={handleReceiptError}
          multiPage={itemsForReceipt.length > 3} // Enable multi-page pour plus de 3 articles
        />
      ) : (
        <>
          {/* Search Area */}
          <View style={styles.searchArea}>
            <SearchBox query={searchQuery} setQuery={setSearchQuery} theme={activeTheme} />
          </View>

          {/* Selected Items Area */}
          {selectedItems.size > 0 && (
            <View style={styles.selectedItemsContainer}>
              <View style={styles.selectedItemsHeader}>
                <Text style={styles.selectedItemsTitle}>
                  Articles sélectionnés ({selectedItems.size})
                </Text>
                <TouchableOpacity 
                  style={styles.clearSelectionButton}
                  onPress={() => setSelectedItems(new Map())}
                >
                  <Text style={styles.clearSelectionText}>Tout effacer</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView 
                horizontal 
                style={styles.selectedItemsScrollView}
                showsHorizontalScrollIndicator={false}
              >
                {Array.from(selectedItems.values()).map(item => renderSelectedItem(item))}
              </ScrollView>
              
              {/* Discount controls */}
              <View style={styles.discountControlContainer}>
                <Text style={styles.discountControlLabel}>Remise globale (%):</Text>
                <View style={styles.discountInputRow}>
                  <TextInput
                    style={styles.discountInput}
                    value={discountPercentage.toString()}
                    onChangeText={(value) => {
                      const percentage = parseFloat(value) || 0;
                      setDiscountPercentage(percentage);
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={activeTheme.text.secondary}
                  />
                  <TouchableOpacity 
                    style={styles.applyDiscountButton}
                    onPress={() => applyTotalDiscount(discountPercentage)}
                  >
                    <Text style={styles.applyDiscountText}>Appliquer</Text>
                  </TouchableOpacity>
                </View>
                {totalDiscount > 0 && (
                  <Text style={styles.totalDiscountText}>
                    Remise totale: {totalDiscount.toFixed(2)}€ ({discountPercentage}%)
                  </Text>
                )}
              </View>
              
              <TouchableOpacity 
                style={styles.generateReceiptButton}
                onPress={handleGenerateReceipt}
              >
                <Icon name="receipt" size={18} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.generateReceiptText}>Générer la facture</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Search Results */}
          <View style={styles.searchResultsContainer}>
            <Text style={styles.searchResultsTitle}>
              {searchQuery.trim() ? 
                `Résultats pour "${searchQuery}"` : 
                "Recherchez des articles à ajouter"
              }
            </Text>
            
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={activeTheme.primary} />
                <Text style={styles.loadingText}>Recherche en cours...</Text>
              </View>
            ) : (
              searchResults.length > 0 ? (
                <FlatList
                  data={searchResults}
                  renderItem={renderSearchItem}
                  keyExtractor={item => item.id.toString()}
                  style={styles.searchResultsList}
                  contentContainerStyle={styles.searchResultsContent}
                />
              ) : (
                searchQuery.trim() ? (
                  <View style={styles.emptyResultsContainer}>
                    <Icon name="search-off" size={40} color={activeTheme.text.disabled} />
                    <Text style={styles.emptyResultsText}>Aucun résultat trouvé</Text>
                  </View>
                ) : (
                  <View style={styles.startSearchContainer}>
                    <Icon name="search" size={40} color={activeTheme.text.disabled} />
                    <Text style={styles.startSearchText}>
                      Commencez votre recherche pour trouver des articles
                    </Text>
                  </View>
                )
              )
            )}
          </View>
        </>
      )}
    </View>
  );
};

const getThemedStyles = (theme: AppThemeType) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    marginLeft: 4,
    color: theme.primary,
  },
  topBarTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginRight: 40, // To balance the back button
    color: theme.text.primary,
  },
  searchArea: {
    padding: 12,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  searchBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: theme.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchBoxInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: theme.text.primary,
  },
  clearButton: {
    padding: 6,
  },
  selectedItemsContainer: {
    backgroundColor: theme.surface,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  selectedItemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  selectedItemsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text.primary,
  },
  clearSelectionButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearSelectionText: {
    fontSize: 14,
    color: theme.primary,
  },
  selectedItemsScrollView: {
    paddingLeft: 12,
  },
  selectedItemCard: {
    width: 140,
    backgroundColor: theme.background,
    marginRight: 8,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  selectedItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedItemName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 4,
    color: theme.text.primary,
  },
  selectedItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.success,
    marginBottom: 8,
  },
  priceControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginVertical: 6,
  },
  priceLabel: {
    fontSize: 13,
    marginRight: 8,
    color: theme.text.secondary,
  },
  priceInput: {
    width: 55, // Largeur fixe pour le champ de prix
    backgroundColor: theme.surface,
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 4,
    fontSize: 13,
    textAlign: 'left',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text.primary,
  },
  priceUnit: {
    marginLeft: 0,
    fontSize: 13,
    color: theme.text.secondary,
  },
  itemDiscountContainer: {
    backgroundColor: theme.danger.light,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginTop: 2,
  },
  itemDiscountText: {
    fontSize: 11,
    color: theme.danger.main,
    textAlign: 'center',
  },
  discountControlContainer: {
    backgroundColor: theme.background,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  discountControlLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: theme.text.primary,
  },
  discountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  discountInput: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: theme.border,
    marginRight: 8,
    color: theme.text.primary,
  },
  applyDiscountButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  applyDiscountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  totalDiscountText: {
    fontSize: 13,
    color: theme.danger.main,
    marginTop: 8,
    textAlign: 'right',
  },
  generateReceiptButton: {
    flexDirection: 'row',
    backgroundColor: theme.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginHorizontal: 16,
  },
  buttonIcon: {
    marginRight: 8,
  },
  generateReceiptText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  confirmationDialog: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  confirmationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: theme.text.primary,
  },
  confirmationText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: theme.text.secondary,
    lineHeight: 22,
  },
  confirmationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  confirmationButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  confirmButton: {
    backgroundColor: theme.primary,
  },
  cancelButton: {
    backgroundColor: theme.text.disabled,
  },
  confirmationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  searchResultsContainer: {
    flex: 1,
    backgroundColor: theme.surface,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  searchResultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text.primary,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  searchResultsList: {
    flex: 1,
  },
  searchResultsContent: {
    paddingBottom: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  selectedItem: {
    backgroundColor: theme.successLight,
  },
  itemImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  noImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.text.primary,
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: theme.text.secondary,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.success,
  },
  selectionIndicator: {
    justifyContent: 'center',
    paddingLeft: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.text.secondary,
  },
  emptyResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyResultsText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.text.secondary,
    textAlign: 'center',
  },
  startSearchContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  startSearchText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.text.secondary,
    textAlign: 'center',
    maxWidth: 240,
  },
});

export default MultiReceiptScreen;
