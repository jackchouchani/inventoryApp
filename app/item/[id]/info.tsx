import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, ScrollView, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Icon } from '../../../src/components';
import { supabase } from '../../../src/config/supabase';
import { formatCurrency } from '../../../src/utils/format';
import { getImageUrl } from '../../../src/utils/r2Client';
import { ReceiptGenerator } from '../../../src/components/ReceiptGenerator';
import { LabelGenerator } from '../../../src/components/LabelGenerator';
import { useCategoriesOptimized as useCategories } from '../../../src/hooks/useCategoriesOptimized';
import { useContainersOptimized as useContainers } from '../../../src/hooks/useContainersOptimized';
import { useAllLocations } from '../../../src/hooks/useOptimizedSelectors';
import { useItem } from '../../../src/hooks/useItem';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../../src/store/store';
import { updateItemStatus } from '../../../src/store/itemsThunks';
import { useAppTheme, type AppThemeType } from '../../../src/contexts/ThemeContext';
import { useUserPermissions } from '../../../src/hooks/useUserPermissions';
import { SimilarItems } from '../../../src/components';
import ItemHistoryList from '../../../src/components/ItemHistoryList';

export default function ItemInfoScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { id } = useLocalSearchParams();
  const { activeTheme } = useAppTheme();
  const userPermissions = useUserPermissions();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isMarkSoldModalVisible, setIsMarkSoldModalVisible] = useState(false);
  const [salePrice, setSalePrice] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isReceiptGeneratorVisible, setIsReceiptGeneratorVisible] = useState(false);
  const [isLabelGeneratorVisible, setIsLabelGeneratorVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  // Utiliser Redux pour tout
  const { item, isLoading, error, refetch } = useItem(id as string);
  const { categories } = useCategories();
  const { data: containers } = useContainers();
  const locations = useAllLocations();

  const styles = useMemo(() => getThemedStyles(activeTheme), [activeTheme]);

  // Récupérer les objets complets via Redux
  const category = useMemo(() => {
    if (!item?.categoryId || !categories) return null;
    const found = categories.find(cat => cat.id === Number(item.categoryId));
    return found;
  }, [item?.categoryId, categories]);

  const container = useMemo(() => {
    if (!item?.containerId || !containers) return null;
    const found = containers.find(cont => cont.id === Number(item.containerId));
    return found;
  }, [item?.containerId, containers]);

  // Récupérer l'emplacement (direct ou via container)
  const location = useMemo(() => {
    if (!item || !locations) return null;
    
    // Emplacement direct de l'article
    if (item.locationId) {
      return locations.find(loc => loc.id === item.locationId) || null;
    }
    
    // Emplacement hérité du container
    if (container?.locationId) {
      return locations.find(loc => loc.id === container.locationId) || null;
    }
    
    return null;
  }, [item, locations, container]);

  // Charger l'image quand l'article est récupéré
  useEffect(() => {
    if (item?.photo_storage_url) {
      setImageLoading(true);
      setImageError(false);
      const url = getImageUrl(item.photo_storage_url);
      setImageUrl(url);
      setImageLoading(false);
    } else {
      setImageUrl(process.env.EXPO_PUBLIC_FALLBACK_IMAGE_URL || null);
    }
  }, [item?.photo_storage_url]);

  // Initialiser le prix de vente
  useEffect(() => {
    if (item) {
      setSalePrice(item.sellingPrice || 0);
    }
  }, [item, category, container]);

  const handleMarkAsSold = async () => {
    if (!item) return;
    
    setIsUpdating(true);
    try {
      // Utiliser Redux thunk au lieu de requête directe
      await dispatch(updateItemStatus({ 
        itemId: Number(item.id), 
        status: 'sold' 
      })).unwrap();

      // Mettre à jour le prix de vente si nécessaire
      if (salePrice !== item.sellingPrice) {
        const { error } = await supabase
          .from('items')
          .update({ selling_price: salePrice })
          .eq('id', item.id);

        if (error) throw error;
      }

      // Actualiser localement les données
      refetch();

      Alert.alert('Succès', 'Article marqué comme vendu avec succès');
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la mise à jour');
    } finally {
      setIsUpdating(false);
      setIsMarkSoldModalVisible(false);
    }
  };

  const handleEditPress = () => {
    router.push(`/item/${id}/edit`);
  };

  const renderImageContent = () => {
    if (imageLoading) {
      return (
        <View style={[styles.itemImage, styles.imagePlaceholder]}>
          <ActivityIndicator size="small" color={activeTheme.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      );
    }
    
    if (imageError) {
      return (
        <View style={[styles.itemImage, styles.errorImagePlaceholder]}>
          <Icon name="error_outline" size={40} color={activeTheme.danger.main} />
          <Text style={styles.errorText}>Erreur de chargement</Text>
        </View>
      );
    }
    
    if (imageUrl) {
      return (
        <Image
          source={{ uri: imageUrl }}
          style={styles.itemImage}
          resizeMode="cover"
          onError={() => {
            console.log("Erreur de chargement de l'image:", imageUrl);
            setImageError(true);
          }}
        />
      );
    }
    
    return (
      <View style={styles.noImageContainer}>
        <Icon name="image_not_supported" size={80} color={activeTheme.text.disabled} />
        <Text style={styles.noImageText}>Pas d'image</Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
        <Text style={styles.message}>Chargement des informations...</Text>
      </View>
    );
  }

  if (error || !item) {
    return (
      <View style={styles.centerContent}>
        <Icon name="error_outline" size={80} color={activeTheme.error} />
        <Text style={styles.errorMessage}>Article introuvable</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Icon name="arrow_back" size={24} color="#ffffff" />
          <Text style={styles.buttonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.detailsContainer}>
        <View style={styles.imageContainer}>
          {renderImageContent()}
        </View>
        
        <View style={styles.itemDetails}>
          <Text style={styles.itemName}>{item.name}</Text>
          
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'details' && styles.activeTabButton]}
              onPress={() => setActiveTab('details')}
            >
              <Text style={[styles.tabButtonText, activeTab === 'details' && styles.activeTabButtonText]}>Détails</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'history' && styles.activeTabButton]}
              onPress={() => setActiveTab('history')}
            >
              <Text style={[styles.tabButtonText, activeTab === 'history' && styles.activeTabButtonText]}>Historique</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'details' && (
            <>
              {/* Prix d'achat - Permission stats.viewPurchasePrice */}
              {userPermissions.canViewPurchasePrice && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Prix d'achat:</Text>
                  <Text style={styles.infoValue}>
                    {formatCurrency(item.purchasePrice || 0)}
                  </Text>
                </View>
              )}
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Prix de vente:</Text>
                <Text style={styles.infoValue}>
                  {formatCurrency(item.sellingPrice || 0)}
                </Text>
              </View>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Catégorie:</Text>
                <Text style={styles.infoValue}>
                  {category?.name || 'Non spécifiée'}
                </Text>
              </View>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Container:</Text>
                <Text style={styles.infoValue}>
                  {container ? `${container.name}#${container.number}` : 'Non spécifié'}
                </Text>
              </View>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Emplacement:</Text>
                <Text style={styles.infoValue}>
                  {location ? location.name : 'Non spécifié'}
                </Text>
              </View>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Statut:</Text>
                <Text style={[
                  styles.statusValue,
                  item.status === 'available' ? styles.availableStatus : styles.soldStatus
                ]}>
                  {item.status === 'available' ? 'Disponible' : 'Vendu'}
                </Text>
              </View>
              
              {item.status === 'sold' && item.soldAt && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Date de vente:</Text>
                  <Text style={styles.infoValue}>
                    {new Date(item.soldAt).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>
              )}
              
              {item.description ? (
                <View style={styles.descriptionContainer}>
                  <Text style={styles.infoLabel}>Description:</Text>
                  <Text style={styles.description}>{item.description}</Text>
                </View>
              ) : null}
            </>
          )}

          {activeTab === 'history' && (
            <ItemHistoryList itemId={Number(id)} />
          )}
          
          <View style={styles.buttonsContainer}>
            {/* Modifier l'article - Permission items.update */}
            {userPermissions.canUpdateItems && (
              <TouchableOpacity
                style={[styles.button, styles.editButton]}
                onPress={handleEditPress}
              >
                <Icon name="edit" size={24} color="#ffffff" />
                <Text style={styles.buttonText}>Modifier l'article</Text>
              </TouchableOpacity>
            )}

            {item.status === 'available' && (
              <>
                {/* Marquer comme vendu - Permission items.update */}
                {userPermissions.canUpdateItems && (
                  <TouchableOpacity
                    style={[styles.button, styles.sellButton]}
                    onPress={() => {
                      setSalePrice(item.sellingPrice || 0);
                      setIsMarkSoldModalVisible(true);
                    }}
                  >
                    <Icon name="shopping_cart" size={24} color="#fff" />
                    <Text style={styles.buttonText}>Marquer comme vendu</Text>
                  </TouchableOpacity>
                )}
                
                {/* Générer un ticket de caisse - Permission features.invoices */}
                {userPermissions.canViewInvoices && (
                  <TouchableOpacity
                    style={[styles.button, styles.receiptButton]}
                    onPress={() => setIsReceiptGeneratorVisible(true)}
                  >
                    <Icon name="receipt" size={24} color="#fff" />
                    <Text style={styles.buttonText}>Générer un ticket de caisse</Text>
                  </TouchableOpacity>
                )}
                
                {/* Générer une étiquette - Permission features.labels */}
                {userPermissions.canViewLabels && (
                  <TouchableOpacity
                    style={[styles.button, styles.labelButton]}
                    onPress={() => setIsLabelGeneratorVisible(true)}
                  >
                    <Icon name="label" size={24} color="#fff" />
                    <Text style={styles.buttonText}>Générer une étiquette</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
            </View>
          </View>

          {/* Section Articles Similaires */}
          <SimilarItems 
            itemId={item.id}
            maxRecommendations={3}
            title="Articles similaires"
          />
        </View>

      {/* Modal pour marquer comme vendu */}
      <Modal
        visible={isMarkSoldModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsMarkSoldModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Marquer comme vendu</Text>
            
            <View style={styles.priceInputContainer}>
              <Text style={styles.priceLabel}>Prix de vente:</Text>
              <TextInput
                style={styles.priceInput}
                keyboardType="numeric"
                value={(salePrice || 0).toString()}
                onChangeText={(text) => setSalePrice(Number(text) || 0)}
                placeholder="Prix de vente"
                placeholderTextColor={activeTheme.text.secondary}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsMarkSoldModalVisible(false)}
                disabled={isUpdating}
              >
                <Text style={styles.buttonText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleMarkAsSold}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Confirmer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal pour le générateur de tickets */}
      <Modal
        visible={isReceiptGeneratorVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsReceiptGeneratorVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Générer un ticket de caisse</Text>
            
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsReceiptGeneratorVisible(false)}
            >
              <Icon name="close" size={24} color={activeTheme.text.primary} />
            </TouchableOpacity>
            
            <ReceiptGenerator
              items={[{
                id: Number(item.id),
                name: item.name,
                qrCode: item.qrCode || '',
                description: item.description || "",
                sellingPrice: item.sellingPrice || 0,
                purchasePrice: item.purchasePrice || 0,
                image: imageUrl || undefined,
                actualSellingPrice: item.sellingPrice || 0
              }]}
              onComplete={() => {
                setIsReceiptGeneratorVisible(false);
                Alert.alert('Succès', 'Ticket de caisse généré avec succès');
              }}
              onError={(error) => {
                setIsReceiptGeneratorVisible(false);
                Alert.alert('Erreur', `Erreur lors de la génération du reçu: ${error.message}`);
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Modal pour le générateur d'étiquettes */}
      <Modal
        visible={isLabelGeneratorVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsLabelGeneratorVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Générer une étiquette</Text>
            
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsLabelGeneratorVisible(false)}
            >
              <Icon name="close" size={24} color={activeTheme.text.primary} />
            </TouchableOpacity>
            
            <LabelGenerator
              items={[{
                id: Number(item.id),
                name: item.name,
                qrCode: item.qrCode || `ITEM-${item.id}`,
                sellingPrice: item.sellingPrice || 0,
                description: item.description || "",
              }]}
              onComplete={() => {
                setIsLabelGeneratorVisible(false);
                Alert.alert('Succès', 'Étiquette PDF générée avec succès');
              }}
              onError={(error) => {
                setIsLabelGeneratorVisible(false);
                Alert.alert('Erreur', `Erreur lors de la génération de l'étiquette: ${error.message}`);
              }}
              mode="items"
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const getThemedStyles = (theme: AppThemeType) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.background,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
    color: theme.text.secondary,
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
    color: theme.error,
    fontWeight: '500',
  },
  detailsContainer: {
    padding: 16,
  },
  imageContainer: {
    height: 350,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.surface,
    marginBottom: 15,
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  noImageText: {
    marginTop: 8,
    fontSize: 16,
    color: theme.text.secondary,
  },
  itemDetails: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: theme.background,
    borderRadius: 8,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTabButton: {
    backgroundColor: theme.primary,
  },
  tabButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text.secondary,
  },
  activeTabButtonText: {
    color: theme.text.onPrimary,
  },
  itemName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: theme.text.primary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.text.secondary,
  },
  infoValue: {
    fontSize: 16,
    color: theme.text.primary,
    fontWeight: '600',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  availableStatus: {
    backgroundColor: theme.successLight,
    color: theme.success,
  },
  soldStatus: {
    backgroundColor: theme.danger.light,
    color: theme.danger.main,
  },
  descriptionContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: theme.text.primary,
    marginTop: 8,
    lineHeight: 22,
  },
  buttonsContainer: {
    marginTop: 16,
    gap: 12,
  },
  button: {
    backgroundColor: theme.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: theme.text.secondary,
  },
  sellButton: {
    backgroundColor: theme.success,
  },
  receiptButton: {
    backgroundColor: theme.warning,
  },
  labelButton: {
    backgroundColor: theme.secondary,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.primary,
    marginTop: 8,
  },
  errorImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.danger.light,
  },
  errorText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.danger.main,
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: theme.surface,
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: theme.text.primary,
  },
  priceInputContainer: {
    marginBottom: 20,
  },
  priceLabel: {
    marginBottom: 8,
    fontSize: 16,
    color: theme.text.primary,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    backgroundColor: theme.surface,
    color: theme.text.primary,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: theme.error,
  },
  confirmButton: {
    backgroundColor: theme.primary,
  },
  closeButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 1,
    padding: 5,
  },
}); 