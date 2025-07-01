import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Image
} from 'react-native';
import { useRouter } from 'expo-router';

// ✅ STYLEFACTORY selon stylefactory-optimization.mdc
import StyleFactory from '../../src/styles/StyleFactory';

// Composants
import { Icon } from '../../src/components';
import { ReceiptGenerator } from '../../src/components/ReceiptGenerator';
import CommonHeader from '../../src/components/CommonHeader';

// Services et utilitaires
import { useSelector, useDispatch } from 'react-redux';
import { selectAllItems } from '../../src/store/selectors';
import { updateItem } from '../../src/store/itemsThunks';
import { AppDispatch } from '../../src/store/store';
import { getImageUrl } from '../../src/utils/r2Client';
import { formatCurrency } from '../../src/utils/formatters';

// Contextes et types
import { useAppTheme, type AppThemeType } from '../../src/contexts/ThemeContext';
import type { Item } from '../../src/types/item';

// Define type for items with added properties for receipt generation
interface ReceiptItem extends Item {
  actualSellingPrice?: number;
  quantity?: number;
}

// Component for searching and selecting items
const SearchBox = ({ query, setQuery, theme }: { query: string; setQuery: (q: string) => void; theme: AppThemeType }) => {
  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(theme, 'MultiReceipt');
  
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
  const dispatch = useDispatch<AppDispatch>();
  
  // ✅ REDUX - Récupération des données depuis le store Redux
  const allItems = useSelector(selectAllItems);
  
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
  
  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'MultiReceipt');
  
  // ✅ REDUX - Fonction de recherche utilisant les données Redux (marche offline et online)
  const searchItemsCallback = useCallback((query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsLoading(true);
    try {
      // Filtrer les items depuis le store Redux
      const searchLower = query.toLowerCase();
      const filteredItems = allItems
        .filter(item => item.status === 'available') // Afficher uniquement les articles disponibles
        .filter(item => 
          item.name.toLowerCase().includes(searchLower) ||
          (item.description && item.description.toLowerCase().includes(searchLower)) ||
          (item.qrCode && item.qrCode.toLowerCase().includes(searchLower))
        )
        .slice(0, 20); // Limiter à 20 résultats
      
      // Convertir les résultats au format ReceiptItem
      const formattedResults = filteredItems.map(item => ({
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
  }, [allItems]);

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
  
  // ✅ REDUX - Marquer les articles comme vendus via Redux thunks (marche offline et online)
  const markItemsAsSold = async () => {
    if (itemsForReceipt.length === 0) return;
    
    setIsUpdatingItems(true);
    try {
      // Traiter chaque article un par un pour mettre à jour son statut et son prix de vente
      const updatePromises = itemsForReceipt.map(async (item) => {
        // Obtenir le prix de vente réel (possiblement modifié par l'utilisateur)
        const actualSalePrice = item.actualSellingPrice ?? item.sellingPrice ?? 0;
        
        // ✅ REDUX - Utiliser le thunk Redux pour la mise à jour
        const updateData = {
          status: 'sold' as const,
          sellingPrice: actualSalePrice,
          soldAt: new Date().toISOString() // Enregistrer la date de vente
        };
        
        await dispatch(updateItem({ id: item.id, updates: updateData })).unwrap();
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
      {/* ✅ COMMONHEADER - Header standardisé */}
      <CommonHeader 
        title="Facture Multiple"
        onBackPress={() => router.back()}
      />

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
                    <Icon name="search_off" size={40} color={activeTheme.text.disabled} />
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

export default MultiReceiptScreen; 