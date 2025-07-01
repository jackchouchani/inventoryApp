import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Platform, ActivityIndicator, Image } from 'react-native';
import { useDispatch } from 'react-redux';
import { Icon } from '../../src/components';
import { updateItem, deleteItem } from '../store/itemsThunks';
import { AppDispatch } from '../store/store';
import type { Category } from '../types/category';
import type { Container } from '../types/container';
import type { Location } from '../types/location';
import type { MaterialIconName } from '../types/icons';
import type { Item } from '../types/item';
import { validateItemName } from '../utils/validation';
import { handleError } from '../utils/errorHandler';
import { checkPhotoPermissions } from '../utils/permissions';
import { usePhoto } from '../hooks/usePhoto';
import ConfirmationDialog from './ConfirmationDialog';
import { useRouter } from 'expo-router';
import { useAppTheme, type AppThemeType } from '../contexts/ThemeContext';
import * as ExpoImagePicker from 'expo-image-picker';
import { useAllLocations } from '../hooks/useOptimizedSelectors';


interface ItemEditFormProps {
    item: Item;
    categories: Category[];
    containers: Container[];
    locations?: Location[];
    onSuccess?: () => void;
    onCancel?: () => void;
}

interface EditedItemForm {
    name: string;
    description?: string;
    purchasePrice: string;
    sellingPrice: string;
    status: 'available' | 'sold';
    photo_storage_url?: string | null;
    containerId?: number | null;
    categoryId?: number;
    locationId?: number | null;
}

const ContainerOption = memo(({ 
    container, 
    isSelected, 
    onSelect,
    theme
}: { 
    container: Container; 
    isSelected: boolean; 
    onSelect: () => void;
    theme: AppThemeType;
}) => {
    const styles = useMemo(() => getThemedStyles(theme), [theme]);
    
    return (
        <TouchableOpacity
            style={[styles.option, isSelected && styles.optionSelected]}
            onPress={onSelect}
        >
            <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                {container.name}#{container.number}
            </Text>
        </TouchableOpacity>
    );
});

const CategoryOption = memo(({ 
    category, 
    isSelected, 
    onSelect,
    theme
}: { 
    category: Category; 
    isSelected: boolean; 
    onSelect: () => void;
    theme: AppThemeType;
}) => {
    const styles = useMemo(() => getThemedStyles(theme), [theme]);
    
    return (
        <TouchableOpacity
            style={[styles.option, isSelected && styles.optionSelected]}
            onPress={onSelect}
        >
            <Icon
                name={(category.icon as MaterialIconName) || 'folder'}
                size={20}
                color={isSelected ? theme.text.onPrimary : theme.text.secondary}
                style={styles.categoryIcon}
            />
            <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                {category.name}
            </Text>
        </TouchableOpacity>
    );
});

const ContainerList = memo(({ 
    containers, 
    selectedId, 
    onSelect,
    onAddNew,
    theme
}: { 
    containers: Container[];
    selectedId?: number | null;
    onSelect: (id: number) => void;
    onAddNew: () => void;
    theme: AppThemeType;
}) => {
    const styles = useMemo(() => getThemedStyles(theme), [theme]);
    
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScrollView}>
            <View style={styles.optionsContainer}>
                {containers.map((container) => (
                    <ContainerOption
                        key={container.id}
                        container={container}
                        isSelected={selectedId === container.id}
                        onSelect={() => onSelect(container.id)}
                        theme={theme}
                    />
                ))}
                <TouchableOpacity
                    style={styles.addNewOption}
                    onPress={onAddNew}
                >
                    <Icon
                        name="add_circle"
                        size={20}
                        color={theme.primary}
                        style={styles.addIcon}
                    />
                    <Text style={styles.addNewText}>Ajouter un container</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
});

const CategoryList = memo(({ 
    categories, 
    selectedId, 
    onSelect,
    onAddNew,
    theme
}: { 
    categories: Category[];
    selectedId?: number | null;
    onSelect: (id: number) => void;
    onAddNew: () => void;
    theme: AppThemeType;
}) => {
    const styles = useMemo(() => getThemedStyles(theme), [theme]);
    
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScrollView}>
            <View style={styles.optionsContainer}>
                {categories.map((category) => (
                    <CategoryOption
                        key={category.id}
                        category={category}
                        isSelected={selectedId === category.id}
                        onSelect={() => onSelect(category.id)}
                        theme={theme}
                    />
                ))}
                <TouchableOpacity
                    style={styles.addNewOption}
                    onPress={onAddNew}
                >
                    <Icon
                        name="add_circle"
                        size={20}
                        color={theme.primary}
                        style={styles.addIcon}
                    />
                    <Text style={styles.addNewText}>Ajouter une catégorie</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
});

const arePropsEqual = (prevProps: ItemEditFormProps, nextProps: ItemEditFormProps) => {
    return (
        prevProps.item.id === nextProps.item.id &&
        prevProps.item.updatedAt === nextProps.item.updatedAt &&
        prevProps.categories.length === nextProps.categories.length &&
        prevProps.containers.length === nextProps.containers.length
    );
};

export const ItemEditForm = memo(({ item, containers: propContainers, categories: propCategories, locations: propLocations, onSuccess, onCancel }) => {
    const { activeTheme } = useAppTheme();
    const styles = useMemo(() => getThemedStyles(activeTheme), [activeTheme]);
    
    // Adapter l'item pour s'assurer que les champs sont en camelCase - MÉMORISÉ pour éviter les re-renders
    const adaptedItem = useMemo(() => {
        const adapted = {
            ...item,
            purchasePrice: item.purchasePrice ?? (item as any).purchase_price ?? 0,
            sellingPrice: item.sellingPrice ?? (item as any).selling_price ?? 0,
            containerId: item.containerId ?? (item as any).container_id ?? null,
            categoryId: item.categoryId ?? (item as any).category_id ?? null,
            locationId: item.locationId ?? (item as any).location_id ?? null,
        };
        
        return adapted;
    }, [item]);
    
    const containers = Array.isArray(propContainers) ? propContainers : [];
    // Trier les catégories par created_at (plus ancien en premier) pour que "Bags" soit en premier
    const categories = Array.isArray(propCategories) 
        ? [...propCategories].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
        : [];
    
    // Charger les emplacements disponibles
    const allLocations = useAllLocations();
    const locations = propLocations || allLocations;
    
    console.log('[ItemEditForm] Debug locations:', {
        propLocations: propLocations?.length || 0,
        allLocations: allLocations?.length || 0,
        finalLocations: locations?.length || 0
    });

    const dispatch = useDispatch<AppDispatch>();
    const { uploadPhoto, deletePhoto, loadImage, state: photoHookState } = usePhoto();

    const router = useRouter();

    const [localImageUri, setLocalImageUri] = useState<string | null>(null);
    const [localImageNeedsUpload, setLocalImageNeedsUpload] = useState(false);

    const [editedItem, setEditedItem] = useState<EditedItemForm>({
        name: adaptedItem.name,
        description: adaptedItem.description || '',
        purchasePrice: (typeof adaptedItem.purchasePrice === 'number' && !isNaN(adaptedItem.purchasePrice)) ? adaptedItem.purchasePrice.toString() : '0',
        sellingPrice: (typeof adaptedItem.sellingPrice === 'number' && !isNaN(adaptedItem.sellingPrice)) ? adaptedItem.sellingPrice.toString() : '0',
        status: adaptedItem.status,
        photo_storage_url: adaptedItem.photo_storage_url,
        containerId: adaptedItem.containerId,
        categoryId: adaptedItem.categoryId,
        locationId: adaptedItem.locationId
    });

    const initialItemState = useMemo(() => {
        const result = {
            name: adaptedItem.name,
            description: adaptedItem.description || '',
            purchasePrice: (typeof adaptedItem.purchasePrice === 'number' && !isNaN(adaptedItem.purchasePrice)) ? adaptedItem.purchasePrice.toString() : '0',
            sellingPrice: (typeof adaptedItem.sellingPrice === 'number' && !isNaN(adaptedItem.sellingPrice)) ? adaptedItem.sellingPrice.toString() : '0',
            status: adaptedItem.status,
            photo_storage_url: adaptedItem.photo_storage_url,
            containerId: adaptedItem.containerId,
            categoryId: adaptedItem.categoryId,
            locationId: adaptedItem.locationId
        };
        
        return result;
    }, [adaptedItem]);

    const [confirmDialog, setConfirmDialog] = useState<{
        visible: boolean;
        itemId: number | null;
    }>({
        visible: false,
        itemId: null
    });



    useEffect(() => {
        setEditedItem(initialItemState);
        setLocalImageUri(null);
        setLocalImageNeedsUpload(false);

        if (adaptedItem.photo_storage_url && typeof adaptedItem.photo_storage_url === 'string') {
            console.log("[ItemEditForm] useEffect - Loading initial image from R2:", adaptedItem.photo_storage_url);
            loadImage(adaptedItem.photo_storage_url);
        } else {
             console.log("[ItemEditForm] useEffect - No initial image to load or photo_storage_url is null.");
        }

        return () => {
             console.log("[ItemEditForm] useEffect - Cleanup");
        };

    }, [initialItemState, adaptedItem.photo_storage_url, adaptedItem.id, loadImage]);

    const hasFormChanged = useMemo(() => {
        const fieldsChanged =
             editedItem.name !== initialItemState.name ||
             editedItem.description !== initialItemState.description ||
             editedItem.purchasePrice !== initialItemState.purchasePrice ||
             editedItem.sellingPrice !== initialItemState.sellingPrice ||
             editedItem.status !== initialItemState.status ||
             editedItem.containerId !== initialItemState.containerId ||
             editedItem.categoryId !== initialItemState.categoryId ||
             editedItem.locationId !== initialItemState.locationId;

         const photoChanged =
             localImageNeedsUpload ||
             editedItem.photo_storage_url !== initialItemState.photo_storage_url;

         return fieldsChanged || photoChanged;
    }, [editedItem, initialItemState, localImageNeedsUpload]);

    const handlePriceChange = useCallback((field: 'purchasePrice' | 'sellingPrice', text: string) => {
        const cleanText = text.replace(',', '.');
        if (cleanText === '' || /^\d*\.?\d*$/.test(cleanText)) {
            setEditedItem(prev => ({ ...prev, [field]: cleanText }));
        }
    }, []);

    const validateForm = useCallback((): boolean => {
        try {
            if (!validateItemName(editedItem.name)) {
                Alert.alert('Erreur', 'Le nom de l\'article est invalide.');
                return false;
            }

            const purchasePrice = parseFloat(editedItem.purchasePrice);
            const sellingPrice = parseFloat(editedItem.sellingPrice);

            if (isNaN(purchasePrice) || purchasePrice < 0) {
                 Alert.alert('Erreur', 'Le prix d\'achat doit être un nombre positif.');
                 return false;
             }
             if (isNaN(sellingPrice) || sellingPrice < 0) {
                 Alert.alert('Erreur', 'Le prix de vente doit être un nombre positif.');
                 return false;
             }

            if (sellingPrice < purchasePrice) {
                Alert.alert('Attention !', 'Le prix de vente est inférieur au prix d\'achat. Vous pouvez vendre à perte si vous le souhaitez.');
                // C'est un avertissement, pas une erreur bloquante. Laissez l'utilisateur continuer s'il le souhaite.
            }

            if (!editedItem.categoryId) {
                 Alert.alert('Erreur', 'La catégorie est requise.');
                 return false;
            }

            return true;
        } catch (error) {
            console.error("[ItemEditForm] validateForm - Erreur:", error);
            handleError(error, 'Erreur de validation', {
                source: 'item_edit_form_validation',
                message: `Erreur lors de la validation de l'article ${adaptedItem.id}`,
                 showAlert: true
            });
            return false;
        }
    }, [editedItem, adaptedItem.id]);

    const handleImagePreview = useCallback(async () => {
        try {
            console.log("[ItemEditForm] handleImagePreview - Sélection d'image...");
            const hasPermissions = await checkPhotoPermissions();
            if (!hasPermissions) {
                console.error("handleImagePreview - Permission refusée");
                Alert.alert('Erreur', 'Permission d\'accès aux photos refusée.');
                return;
            }

            console.log("[ItemEditForm] handleImagePreview - Lancement du sélecteur d'image...");
            const result = await ExpoImagePicker.launchImageLibraryAsync({
                mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.3,
                base64: true,
                exif: false,
            });

            console.log("[ItemEditForm] handleImagePreview - Résultat du sélecteur:", {
                canceled: result.canceled,
                hasAssets: result.assets ? result.assets.length : 0
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const selectedAsset = result.assets[0];
                console.log("[ItemEditForm] handleImagePreview - Asset sélectionné:", {
                    uri: selectedAsset.uri ? selectedAsset.uri.substring(0, 50) + "..." : "null",
                    hasBase64: !!selectedAsset.base64,
                    mimeType: selectedAsset.mimeType,
                    width: selectedAsset.width,
                    height: selectedAsset.height
                });

                let selectedUri = selectedAsset.uri;

                // Traitement spécial pour le web (mobile et desktop)
                if (Platform.OS === 'web') {
                    // Pour le web, toujours privilégier le format base64
                    if (selectedAsset.base64) {
                        const mimeType = selectedAsset.mimeType || 'image/jpeg';
                        const base64Uri = `data:${mimeType};base64,${selectedAsset.base64}`;
                        selectedUri = base64Uri;
                        console.log("[ItemEditForm] Image convertie en base64 pour le web");
                    } else {
                        console.error("handleImagePreview - Impossible d'obtenir l'image en base64");
                        Alert.alert('Erreur', 'Impossible d\'obtenir l\'image en format compatible');
                        return;
                    }
                }

                // Pas de validation bloquante - on laisse l'upload gérer la compression et validation
                setLocalImageUri(selectedUri);
                setLocalImageNeedsUpload(true);
                setEditedItem(prev => ({ ...prev, photo_storage_url: undefined }));
            } else {
                console.log("[ItemEditForm] handleImagePreview - Sélection d'image annulée ou aucun asset.");
            }
        } catch (error) {
            console.error("handleImagePreview - Erreur:", error);
            handleError(error, 'Erreur sélection photo', {
                source: 'item_edit_form_image_preview',
                message: `Échec de la sélection de la photo pour l'article ${adaptedItem.id}`,
                showAlert: true
            });
        }
    }, [adaptedItem.id]);

    const handleSubmit = useCallback(async () => {
        if (!hasFormChanged) {
            Alert.alert('Information', 'Aucune modification à enregistrer.');
            return;
        }

        if (!validateForm()) {
            console.log("[ItemEditForm] handleSubmit - Échec de la validation du formulaire.");
            return;
        }

        if (!adaptedItem.id) {
            console.error("[ItemEditForm] handleSubmit - ID de l'article manquant");
            Alert.alert('Erreur interne', "Impossible de sauvegarder: ID de l'article manquant.");
            return;
        }

        let finalPhotoStorageUrl = editedItem.photo_storage_url;

        // Cas 1: Suppression d'une image existante (bouton "Supprimer" cliqué)
        if (adaptedItem.photo_storage_url && editedItem.photo_storage_url === null) {
            console.log(`[ItemEditForm] handleSubmit - Suppression de l'image existante ${adaptedItem.photo_storage_url} demandée.`);
            try {
                await deletePhoto(adaptedItem.photo_storage_url);
                console.log(`[ItemEditForm] handleSubmit - Image R2 ${adaptedItem.photo_storage_url} supprimée.`);
                finalPhotoStorageUrl = null;
            } catch (deleteError) {
                console.warn(`[ItemEditForm] handleSubmit - Échec de la suppression de l'image R2 ${adaptedItem.photo_storage_url}:`, deleteError);
                handleError(deleteError, 'Avertissement Suppression Image', {
                    source: 'item_edit_form_delete_existing_r2_onsave',
                    message: `Échec de la suppression de l'image existante. L'article sera mis à jour sans l'image.`,
                    showAlert: true
                });
                // On force la suppression de l'image dans la base même si la suppression R2 a échoué
                finalPhotoStorageUrl = null;
            }
        }
        // Cas 2: Upload d'une nouvelle image
        else if (localImageUri && localImageNeedsUpload) {
            console.log("[ItemEditForm] handleSubmit - Upload d'une nouvelle image nécessaire.");
            try {
                const uploadedFilename = await uploadPhoto(localImageUri, true, adaptedItem.photo_storage_url || undefined);
                if (uploadedFilename) {
                    console.log(`[ItemEditForm] handleSubmit - Nouvelle image R2 uploadée: ${uploadedFilename}`);
                    finalPhotoStorageUrl = uploadedFilename;
                    setLocalImageNeedsUpload(false);
                    setLocalImageUri(null);
                } else {
                    console.warn("[ItemEditForm] handleSubmit - Échec de l'upload de la nouvelle image.");
                    finalPhotoStorageUrl = undefined;
                }
            } catch (uploadError) {
                console.error("[ItemEditForm] handleSubmit - Erreur lors de l'upload de la nouvelle image:", uploadError);
                handleError(uploadError, 'Erreur Upload', {
                    source: 'item_edit_form_upload_new_r2',
                    message: `Échec de l'upload de la nouvelle image.`,
                    showAlert: true
                });
                finalPhotoStorageUrl = undefined;
            }
        }

        // Préparation des données pour la mise à jour de la base de données
        const itemToUpdateToSendToDB: any = {
            name: editedItem.name,
            description: editedItem.description,
            purchasePrice: parseFloat(editedItem.purchasePrice) || 0,
            sellingPrice: parseFloat(editedItem.sellingPrice) || 0,
            status: editedItem.status,
            containerId: editedItem.containerId,
            categoryId: editedItem.categoryId,
            locationId: editedItem.locationId
        };

        if (finalPhotoStorageUrl !== undefined) {
            itemToUpdateToSendToDB.photo_storage_url = finalPhotoStorageUrl;
        }

        try {
            console.log(`[ItemEditForm] handleSubmit - Mise à jour de l'article ${adaptedItem.id} via Redux thunk`);
            
            // ✅ UTILISER REDUX THUNK - Remplace database.updateItem + dispatch manuel
            await dispatch(updateItem({
                id: adaptedItem.id,
                updates: {
                    name: itemToUpdateToSendToDB.name,
                    description: itemToUpdateToSendToDB.description,
                    purchasePrice: itemToUpdateToSendToDB.purchasePrice,
                    sellingPrice: itemToUpdateToSendToDB.sellingPrice,
                    categoryId: itemToUpdateToSendToDB.categoryId,
                    containerId: itemToUpdateToSendToDB.containerId,
                    locationId: itemToUpdateToSendToDB.locationId,
                    photo_storage_url: finalPhotoStorageUrl
                }
            })).unwrap();

            if (onSuccess) onSuccess();
        } catch (error) {
            console.error("[ItemEditForm] handleSubmit - Erreur lors de la mise à jour finale:", error);
            handleError(error, 'Erreur lors de la mise à jour', {
                source: 'item_edit_form_update_db',
                message: `Échec de la mise à jour de l'article ${adaptedItem.id}.`,
                showAlert: true
            });
        }
    }, [editedItem, adaptedItem, validateForm, deletePhoto, uploadPhoto, dispatch, onSuccess, localImageUri, localImageNeedsUpload, hasFormChanged]);

    const handleDelete = useCallback(async () => {
        if (!adaptedItem.id) {
             console.warn("[ItemEditForm] handleDelete - ID de l'article manquant.");
             return;
        }

        setConfirmDialog({
            visible: true,
            itemId: adaptedItem.id
        });
    }, [adaptedItem.id]);

    const handleConfirmDelete = useCallback(async () => {
        const itemId = confirmDialog.itemId;
        if (!itemId) {
             console.warn("[ItemEditForm] handleConfirmDelete - ID de l'article manquant dans la confirmation.");
             setConfirmDialog({ visible: false, itemId: null });
             return;
        }

        try {
            console.log(`[ItemEditForm] handleConfirmDelete - Suppression de l'article ${itemId} via Redux thunk.`);

            if (adaptedItem.photo_storage_url) {
                console.log(`[ItemEditForm] handleConfirmDelete - Suppression de l'image R2 associée: ${adaptedItem.photo_storage_url}`);
                 try {
                    await deletePhoto(adaptedItem.photo_storage_url);
                    console.log(`[ItemEditForm] handleConfirmDelete - Image R2 associée supprimée avec succès.`);
                 } catch (deleteError) {
                    console.warn(`[ItemEditForm] handleConfirmDelete - Échec de la suppression de l'image R2 ${adaptedItem.photo_storage_url} lors de la suppression de l'item:`, deleteError);
                     handleError(deleteError, 'Avertissement Suppression Image', {
                        source: 'item_edit_form_delete_item_image',
                         message: `L'article a été supprimé, mais son image n'a pas pu être supprimée du serveur.`,
                         showAlert: true
                    });
                 }
            }

            // ✅ UTILISER REDUX THUNK - Remplace database.deleteItem + dispatch manuel
            await dispatch(deleteItem(itemId)).unwrap();

            console.log("[ItemEditForm] handleConfirmDelete - Article supprimé avec succès, navigation vers la page stock");
            // Après suppression réussie, naviguer vers la page stock au lieu d'appeler onCancel
            router.replace('/stock');
        } catch (error) {
            console.error("[ItemEditForm] handleConfirmDelete - Erreur lors de la suppression finale de l'article:", error);
            handleError(error, 'Erreur lors de la suppression', {
                source: 'item_edit_form_delete_item_db',
                message: `Échec de la suppression de l'article ${adaptedItem.id}.`,
                showAlert: true
            });
        } finally {
            setConfirmDialog({ visible: false, itemId: null });
        }
    }, [confirmDialog.itemId, dispatch, adaptedItem, deletePhoto, router]);

    const handleCancelDelete = useCallback(() => {
        console.log("[ItemEditForm] handleCancelDelete - Suppression annulée.");
        setConfirmDialog({ visible: false, itemId: null });
    }, []);

    const handlePhotoDelete = useCallback(async () => {
        console.log("[ItemEditForm] handlePhotoDelete - Suppression de la photo demandée via UI");
        if (!adaptedItem.photo_storage_url) {
            console.log("[ItemEditForm] handlePhotoDelete - Aucune photo existante à supprimer.");
            setLocalImageUri(null);
            setLocalImageNeedsUpload(false);
            setEditedItem(prev => ({ ...prev, photo_storage_url: null }));
            return;
        }

        try {
            console.log(`[ItemEditForm] handlePhotoDelete - Suppression de l'image R2: ${adaptedItem.photo_storage_url}`);
            await deletePhoto(adaptedItem.photo_storage_url);

            console.log("[ItemEditForm] handlePhotoDelete - Image R2 supprimée avec succès.");

            console.log(`[ItemEditForm] handlePhotoDelete - Mise à jour de l'article ${adaptedItem.id} via Redux thunk (photo_storage_url = null).`);
            
            // ✅ UTILISER REDUX THUNK - Remplace database.updateItem + dispatch manuel
            await dispatch(updateItem({
                id: adaptedItem.id,
                updates: { photo_storage_url: null }
            })).unwrap();

            setLocalImageUri(null);
            setLocalImageNeedsUpload(false);
            setEditedItem(prev => ({ ...prev, photo_storage_url: null }));

            Alert.alert('Succès', 'L\'image a été supprimée.');

        } catch (error) {
            console.error("[ItemEditForm] handlePhotoDelete - Erreur lors de la suppression de la photo:", error);
            handleError(error, 'Erreur Suppression Image', {
                source: 'item_edit_form_image_delete_immediate',
                message: `Échec de la suppression de l'image.`,
                showAlert: true
            });
        }
    }, [adaptedItem, deletePhoto, dispatch]);

    const navigateToAddContainer = useCallback(() => {
        // Naviguer vers la page d'ajout de container avec un paramètre de retour
        router.push({
            pathname: '/container/add',
            params: { returnTo: `/item/${adaptedItem.id}/edit` }
        });
    }, [router, adaptedItem.id]);

    const navigateToAddCategory = useCallback(() => {
        // Naviguer vers la page d'ajout de catégorie avec un paramètre de retour
        router.push({
            pathname: '/category/add',
            params: { returnTo: `/item/${adaptedItem.id}/edit` }
        });
    }, [router, adaptedItem.id]);

    const handleContainerSelect = useCallback((containerId: number | undefined) => {
        if (containerId) {
            // Si on sélectionne un container, hériter de son emplacement
            const selectedContainer = containers.find(c => c.id === containerId);
            setEditedItem(prev => ({ 
                ...prev, 
                containerId,
                locationId: selectedContainer?.locationId || null
            }));
        } else {
            setEditedItem(prev => ({ ...prev, containerId: null }));
        }
    }, [containers]);

    const displayImageUri = localImageUri || photoHookState.uri;
    const isPhotoProcessing = photoHookState.loading;
    const photoError = photoHookState.error;

    const isSaveDisabled = !hasFormChanged || isPhotoProcessing;

    return (
        <ScrollView style={styles.container}>
            <View style={styles.contentContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Nom de l'article"
                    value={editedItem.name}
                    onChangeText={(text) => setEditedItem(prev => ({ ...prev, name: text }))}
                    placeholderTextColor={activeTheme.text.secondary}
                />

                <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Description de l'article"
                    value={editedItem.description}
                    onChangeText={(text) => setEditedItem(prev => ({ ...prev, description: text }))}
                    multiline
                    numberOfLines={4}
                    placeholderTextColor={activeTheme.text.secondary}
                />

                <View style={styles.priceContainer}>
                    <View style={styles.priceInputWrapper}>
                        <View style={styles.priceLabelContainer}>
                            <Text style={styles.priceLabel}>Prix d'achat (€)</Text>
                        </View>
                        <TextInput
                            style={[styles.input, styles.priceInput]}
                            placeholder="100"
                            value={editedItem.purchasePrice}
                            keyboardType="decimal-pad"
                            onChangeText={(text) => handlePriceChange('purchasePrice', text)}
                            placeholderTextColor={activeTheme.text.secondary}
                        />
                    </View>
                    <View style={styles.priceInputWrapper}>
                        <View style={styles.priceLabelContainer}>
                            <Text style={styles.priceLabel}>Prix de vente (€)</Text>
                        </View>
                        <TextInput
                            style={[styles.input, styles.priceInput]}
                            placeholder="200"
                            value={editedItem.sellingPrice}
                            keyboardType="decimal-pad"
                            onChangeText={(text) => handlePriceChange('sellingPrice', text)}
                            placeholderTextColor={activeTheme.text.secondary}
                        />
                    </View>
                </View>

                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Photo</Text>
                    <View style={styles.imageContainer}>
                         {displayImageUri || isPhotoProcessing || photoError ? (
                            <View style={styles.imageWrapper}>
                                {isPhotoProcessing ? (
                                    <View style={[styles.image, styles.imagePlaceholder]}>
                                        <ActivityIndicator size="small" color={activeTheme.primary} />
                                        <Text style={styles.loadingText}>Chargement...</Text>
                                    </View>
                                ) : photoError ? (
                                    <View style={[styles.image, styles.errorImagePlaceholder]}>
                                        <Icon name="error_outline" size={24} color={activeTheme.danger.main} />
                                        <Text style={styles.errorText}>Erreur de chargement</Text>
                                    </View>
                                ) : displayImageUri && (
                                    <Image
                                        source={{ uri: displayImageUri }}
                                        style={styles.image}
                                        resizeMode="cover"
                                        {...(Platform.OS === 'web' ? {
                                            loading: "eager",
                                            fetchPriority: "high",
                                        } : {})}
                                    />
                                )}
                                <View style={styles.imageActions}>
                                    <TouchableOpacity
                                        style={styles.imageActionButton}
                                        onPress={handleImagePreview}
                                        disabled={isPhotoProcessing}
                                    >
                                        <Icon name="edit" size={24} color={isPhotoProcessing ? activeTheme.text.disabled : activeTheme.primary} />
                                    </TouchableOpacity>
                                    {(adaptedItem.photo_storage_url !== null && adaptedItem.photo_storage_url !== undefined) || localImageUri ? (
                                         <TouchableOpacity
                                             style={styles.imageActionButton}
                                             onPress={handlePhotoDelete}
                                             disabled={isPhotoProcessing}
                                         >
                                             <Icon name="delete" size={24} color={isPhotoProcessing ? activeTheme.text.disabled : activeTheme.error} />
                                         </TouchableOpacity>
                                    ) : null}
                                </View>
                                {localImageNeedsUpload && !isPhotoProcessing && (
                                    <View style={styles.newImageBadge}>
                                        <Icon name="cloud_upload" size={14} color="#FFFFFF" />
                                        <Text style={styles.newImageText}>En attente d'upload</Text>
                                    </View>
                                )}
                                {isPhotoProcessing && (
                                    <View style={styles.uploadingOverlay}>
                                        <ActivityIndicator size="large" color="#FFFFFF" />
                                        <Text style={styles.uploadingText}>Opération en cours...</Text>
                                    </View>
                                )}
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.imagePicker}
                                onPress={handleImagePreview}
                                disabled={isPhotoProcessing}
                            >
                                <Icon name="add_photo_alternate" size={48} color={isPhotoProcessing ? activeTheme.text.disabled : activeTheme.primary} />
                                <Text style={[styles.imagePickerText, isPhotoProcessing && {color: activeTheme.text.disabled}]}>
                                    {isPhotoProcessing ? "Opération en cours..." : "Sélectionner une image"}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Container</Text>
                    <ContainerList
                        containers={containers}
                        selectedId={editedItem.containerId}
                        onSelect={handleContainerSelect}
                        onAddNew={navigateToAddContainer}
                        theme={activeTheme}
                    />
                </View>

                {/* Section Emplacement - Affichage simple */}
                {!editedItem.containerId && (
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionTitle}>
                            Emplacement
                        </Text>
                        <Text style={styles.sectionDescription}>
                            L'emplacement est assigné automatiquement lors de l'assignation à un container.
                        </Text>
                        <View style={[
                            styles.inputContainer, 
                            {
                                backgroundColor: activeTheme.backgroundSecondary,
                                borderWidth: 1,
                                borderColor: activeTheme.border,
                                borderRadius: 8,
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 12,
                                paddingHorizontal: 16
                            }
                        ]}>
                            <Icon 
                                name={editedItem.locationId ? "location_on" : "location_off"} 
                                size={20} 
                                color={editedItem.locationId ? activeTheme.primary : activeTheme.text.disabled} 
                                style={{ marginRight: 12 }}
                            />
                            <Text style={[
                                styles.inputText, 
                                { 
                                    color: editedItem.locationId ? activeTheme.text.primary : activeTheme.text.secondary,
                                    flex: 1,
                                    fontSize: 16
                                }
                            ]}>
                                {editedItem.locationId 
                                    ? locations.find(l => l.id === editedItem.locationId)?.name || 'Emplacement introuvable'
                                    : 'Aucun emplacement assigné'}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Affichage de l'emplacement hérité du container */}
                {editedItem.containerId && (() => {
                    const selectedContainer = containers.find(c => c.id === editedItem.containerId);
                    const containerLocation = selectedContainer?.locationId ? 
                        locations.find(l => l.id === selectedContainer.locationId) : null;
                    
                    return containerLocation ? (
                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionTitle}>Emplacement (Hérité du container)</Text>
                            <View style={styles.inheritedLocationDisplay}>
                                <Icon name="location_on" size={16} color={activeTheme.primary} />
                                <Text style={styles.inheritedLocationText}>
                                    {containerLocation.name}
                                    {containerLocation.address && ` - ${containerLocation.address}`}
                                </Text>
                            </View>
                        </View>
                    ) : null;
                })()}

                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Catégorie</Text>
                    <CategoryList
                        categories={categories}
                        selectedId={editedItem.categoryId}
                        onSelect={(id) => setEditedItem(prev => ({ ...prev, categoryId: id }))}
                        onAddNew={navigateToAddCategory}
                        theme={activeTheme}
                    />
                </View>



                <View style={styles.buttonContainer}>
                    <View style={styles.secondaryButtonsRow}>
                        <TouchableOpacity
                            style={[styles.deleteButton, isPhotoProcessing && styles.disabledButton]}
                            onPress={handleDelete}
                            disabled={isPhotoProcessing}
                        >
                            <Icon name="delete" size={20} color="#fff" />
                            <Text style={styles.buttonText}>Supprimer</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.cancelButton, isPhotoProcessing && styles.disabledButton]}
                            onPress={onCancel}
                            disabled={isPhotoProcessing}
                        >
                            <Text style={styles.buttonText}>Annuler</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                        style={[
                            styles.saveButton,
                            isSaveDisabled ? styles.disabledButton : null,
                            localImageNeedsUpload && !isPhotoProcessing ? styles.uploadButton : null
                        ]}
                        onPress={() => {
                            console.log("[ItemEditForm] Bouton de sauvegarde cliqué");
                            handleSubmit();
                        }}
                        disabled={isSaveDisabled}
                    >
                        {localImageNeedsUpload && !isPhotoProcessing ? (
                            <>
                                <Icon name="cloud_upload" size={20} color="#fff" />
                                <Text style={styles.buttonText}>Uploader & Sauvegarder</Text>
                            </>
                        ) : isPhotoProcessing ? (
                             <Text style={styles.buttonText}>Opération en cours...</Text>
                        ) : (
                            <>
                                <Icon name="save" size={20} color="#fff" />
                                <Text style={styles.buttonText}>Mettre à jour</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <ConfirmationDialog
                visible={confirmDialog.visible}
                title="Confirmation de suppression"
                message="Êtes-vous sûr de vouloir supprimer cet article ? Cette action est irréversible."
                confirmText="Supprimer"
                cancelText="Annuler"
                confirmButtonStyle="destructive"
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
            />
            {photoError && (
                <View style={styles.globalErrorContainer}>
                    <Icon name="error_outline" size={24} color={activeTheme.danger.main} />
                    <Text style={styles.globalErrorText}>{photoError.message}</Text>
                </View>
            )}
        </ScrollView>
    );
}, arePropsEqual);

const getThemedStyles = (theme: AppThemeType) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    contentContainer: {
        padding: 16,
    },
    input: {
        backgroundColor: theme.surface,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        fontSize: 16,
        color: theme.text.primary,
        borderWidth: 1,
        borderColor: theme.border,
        elevation: 0,
    },
    textArea: {
        height: 120,
        textAlignVertical: 'top',
    },
    priceContainer: {
        flexDirection: 'column',
        gap: 16,
        marginBottom: 16,
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 3,
            },
            android: {
                elevation: 2,
            },
            web: {
                boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
            },
        }),
    },
    priceInputWrapper: {
        flexDirection: 'column',
        gap: 8,
    },
    priceLabelContainer: {
        marginBottom: 4,
    },
    priceLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.text.secondary,
    },
    priceInput: {
        backgroundColor: theme.surface,
        borderRadius: 8,
        padding: 12,
        textAlign: 'right',
        fontSize: 18,
        color: theme.primary,
        fontWeight: '600',
        marginBottom: 0,
        borderWidth: 1,
        borderColor: theme.border,
        minHeight: 48,
    },
    imageContainer: {
        marginTop: 8,
    },
    imageWrapper: {
        aspectRatio: 4/3,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
    },
    sectionContainer: {
        marginBottom: 16,
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 3,
            },
            android: {
                elevation: 2,
            },
            web: {
                boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
            },
        }),
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
        color: theme.text.primary,
    },
    optionsScrollView: {
        marginBottom: 0,
    },
    optionsContainer: {
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 4,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: theme.background,
        borderWidth: 1,
        borderColor: theme.border,
    },
    optionSelected: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
    },
    optionText: {
        fontSize: 14,
        color: theme.text.primary,
    },
    optionTextSelected: {
        color: theme.text.onPrimary,
        fontWeight: '500',
    },
    categoryIcon: {
        marginRight: 8,
    },

    buttonContainer: {
        flexDirection: 'column',
        marginTop: 16,
        marginBottom: 16,
        gap: 12,
    },
    secondaryButtonsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
        flexDirection: 'row',
        gap: 8,
    },
    saveButton: {
        backgroundColor: theme.primary,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 3,
            },
            android: {
                elevation: 3,
            },
            web: {
                boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.2)',
            },
        }),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 12,
        minHeight: 56,
    },

    buttonIcon: {
        marginRight: 4,
    },
    uploadButton: {
        backgroundColor: theme.success,
    },
    disabledButton: {
        backgroundColor: theme.text.disabled,
        opacity: 0.7,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: theme.text.secondary,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    deleteButton: {
        flex: 1,
        backgroundColor: theme.error,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        minHeight: 48,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    noDataText: {
        color: theme.text.secondary,
        fontStyle: 'italic',
        padding: 8,
    },
    formSection: {
        marginBottom: 16,
    },
    imageActions: {
        position: 'absolute',
        top: 8,
        right: 8,
        flexDirection: 'row',
        gap: 8,
    },
    imageActionButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 20,
        padding: 8,
    },
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    newImageBadge: {
        position: 'absolute',
        top: 0,
        left: 0,
        backgroundColor: theme.primary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderTopLeftRadius: 8,
        borderBottomRightRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    newImageText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    imagePicker: {
        aspectRatio: 4/3,
        borderRadius: 8,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    imagePickerText: {
        marginTop: 8,
        color: theme.primary,
        fontSize: 16,
        fontWeight: '500',
    },
    uploadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
        zIndex: 10,
    },
    uploadingText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 8,
    },
    addNewOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: theme.primaryLight,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme.primary,
    },
    addNewText: {
        fontSize: 14,
        color: theme.primary,
        fontWeight: '500',
    },
    addIcon: {
        marginRight: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 10,
    },
    modalContent: {
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: 10,
        width: '100%',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3,
            },
            android: {
                elevation: 5,
            },
            web: {
                boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.25)',
            },
        }),
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: theme.text.primary,
        marginBottom: 16,
    },
    modalButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalButtonSave: {
        backgroundColor: theme.primary,
    },
    modalButtonCancel: {
        backgroundColor: theme.text.secondary,
    },
    modalButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    iconSelectorLabel: {
        marginTop: 16,
        marginBottom: 8,
        fontSize: 16,
        fontWeight: '500',
        color: theme.text.primary,
    },
    iconSelector: {
        maxHeight: 150,
        marginBottom: 16,
    },
    iconSelectorContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingVertical: 8,
    },
    iconOption: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        margin: 4,
        borderRadius: 22,
        backgroundColor: theme.background,
    },
    iconOptionSelected: {
        backgroundColor: theme.primary,
    },
    imagePlaceholder: {
        backgroundColor: theme.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: theme.primary,
        fontSize: 14,
        marginTop: 4,
        textAlign: 'center',
    },
    errorImagePlaceholder: {
        backgroundColor: theme.danger.light,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: theme.danger.main,
        fontSize: 14,
        marginTop: 4,
        textAlign: 'center',
    },
    globalErrorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.danger.light,
        padding: 12,
        borderRadius: 8,
        marginHorizontal: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: theme.danger.main,
    },
    globalErrorText: {
        marginLeft: 8,
        color: theme.danger.main,
        fontSize: 14,
        flexShrink: 1,
    },
    sectionDescription: {
        fontSize: 13,
        color: theme.text.secondary,
        marginBottom: 12,
        lineHeight: 18,
        fontStyle: 'italic',
    },
    inheritedLocationDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.backgroundSecondary,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.border,
    },
    inheritedLocationText: {
        marginLeft: 8,
        color: theme.text.primary,
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    inputContainer: {
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    inputText: {
        fontSize: 16,
        color: theme.text.primary,
    },

});