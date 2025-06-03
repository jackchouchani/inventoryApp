import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Platform, ActivityIndicator, Image } from 'react-native';
import { useDispatch } from 'react-redux';
import { database, Category, Container } from '../database/database';
import { Icon } from '../../src/components';
import { deleteItem, updateItem } from '../store/itemsActions';
import { AppDispatch } from '../store/store';
import { fetchItems } from '../store/itemsThunks';
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
import { LabelGenerator } from './LabelGenerator';

interface ItemEditFormProps {
    item: Item;
    categories: Category[];
    containers: Container[];
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

export const ItemEditForm = memo(({ item, containers: propContainers, categories: propCategories, onSuccess, onCancel }) => {
    console.log('=== DEBUG ITEM EDIT FORM ===');
    console.log('18. Props reçues dans ItemEditForm:');
    console.log('  - item brut:', item);
    console.log('  - item.purchasePrice:', item?.purchasePrice, 'type:', typeof item?.purchasePrice);
    console.log('  - item.sellingPrice:', item?.sellingPrice, 'type:', typeof item?.sellingPrice);
    console.log('  - item.containerId:', item?.containerId, 'type:', typeof item?.containerId);
    console.log('  - item.categoryId:', item?.categoryId, 'type:', typeof item?.categoryId);
    
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
        };
        
        console.log('18b. Item adapté dans ItemEditForm (useMemo):');
        console.log('  - adaptedItem.purchasePrice:', adapted.purchasePrice, 'type:', typeof adapted.purchasePrice);
        console.log('  - adaptedItem.sellingPrice:', adapted.sellingPrice, 'type:', typeof adapted.sellingPrice);
        console.log('  - adaptedItem.containerId:', adapted.containerId, 'type:', typeof adapted.containerId);
        console.log('  - adaptedItem.categoryId:', adapted.categoryId, 'type:', typeof adapted.categoryId);
        
        return adapted;
    }, [item]);
    
    console.log('  - propContainers:', propContainers?.length, propContainers);
    console.log('  - propCategories:', propCategories?.length, propCategories);

    const containers = Array.isArray(propContainers) ? propContainers : [];
    // Trier les catégories par created_at (plus ancien en premier) pour que "Bags" soit en premier
    const categories = Array.isArray(propCategories) 
        ? [...propCategories].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
        : [];

    console.log('19. Après traitement des props:');
    console.log('  - containers final:', containers.length, containers);
    console.log('  - categories final:', categories.length, categories);

    const dispatch = useDispatch<AppDispatch>();
    const { uploadPhoto, deletePhoto, loadImage, state: photoHookState, validatePhoto } = usePhoto();

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
        categoryId: adaptedItem.categoryId
    });

    console.log('20. État initial editedItem après useState:');
    console.log('  - name:', editedItem.name);
    console.log('  - description:', editedItem.description);
    console.log('  - purchasePrice:', editedItem.purchasePrice, 'type:', typeof editedItem.purchasePrice);
    console.log('  - sellingPrice:', editedItem.sellingPrice, 'type:', typeof editedItem.sellingPrice);
    console.log('  - containerId:', editedItem.containerId, 'type:', typeof editedItem.containerId);
    console.log('  - categoryId:', editedItem.categoryId, 'type:', typeof editedItem.categoryId);
    console.log('  - editedItem complet:', editedItem);

    const initialItemState = useMemo(() => {
        console.log('[ItemEditForm] Calculating initialItemState with adaptedItem:', adaptedItem);
        console.log('[ItemEditForm] adaptedItem.purchasePrice:', typeof adaptedItem.purchasePrice, adaptedItem.purchasePrice);
        console.log('[ItemEditForm] adaptedItem.sellingPrice:', typeof adaptedItem.sellingPrice, adaptedItem.sellingPrice);
        console.log('[ItemEditForm] adaptedItem.containerId:', typeof adaptedItem.containerId, adaptedItem.containerId);
        console.log('[ItemEditForm] adaptedItem.categoryId:', typeof adaptedItem.categoryId, adaptedItem.categoryId);
        
        const result = {
            name: adaptedItem.name,
            description: adaptedItem.description || '',
            purchasePrice: (typeof adaptedItem.purchasePrice === 'number' && !isNaN(adaptedItem.purchasePrice)) ? adaptedItem.purchasePrice.toString() : '0',
            sellingPrice: (typeof adaptedItem.sellingPrice === 'number' && !isNaN(adaptedItem.sellingPrice)) ? adaptedItem.sellingPrice.toString() : '0',
            status: adaptedItem.status,
            photo_storage_url: adaptedItem.photo_storage_url,
            containerId: adaptedItem.containerId,
            categoryId: adaptedItem.categoryId
        };
        
        console.log('[ItemEditForm] Final initialItemState:', result);
        return result;
    }, [adaptedItem]);

    console.log('21. initialItemState calculé:');
    console.log('  - purchasePrice:', initialItemState.purchasePrice);
    console.log('  - sellingPrice:', initialItemState.sellingPrice);
    console.log('  - containerId:', initialItemState.containerId);
    console.log('  - categoryId:', initialItemState.categoryId);
    console.log('=== FIN DEBUG ITEM EDIT FORM ===');

    const [confirmDialog, setConfirmDialog] = useState<{
        visible: boolean;
        itemId: number | null;
    }>({
        visible: false,
        itemId: null
    });

    const [showLabelGenerator, setShowLabelGenerator] = useState(false);

    useEffect(() => {
        console.log("[ItemEditForm] useEffect - Initializing form with item:", adaptedItem.id);
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
             editedItem.categoryId !== initialItemState.categoryId;

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

                console.log("[ItemEditForm] Image sélectionnée:", selectedUri.substring(0, 50) + "...");

                // Pas de validation bloquante - on laisse l'upload gérer la compression et validation
                console.log("[ItemEditForm] handleImagePreview - Validation ignorée, passage direct à la mise à jour des états");

                console.log("[ItemEditForm] handleImagePreview - Mise à jour des états...");
                setLocalImageUri(selectedUri);
                setLocalImageNeedsUpload(true);
                setEditedItem(prev => ({ ...prev, photo_storage_url: undefined }));
                console.log("[ItemEditForm] handleImagePreview - États mis à jour avec succès");

            } else {
                console.log("[ItemEditForm] handleImagePreview - Sélection d'image annulée ou aucun asset.");
                if (result.canceled) {
                    console.log("[ItemEditForm] handleImagePreview - Utilisateur a annulé la sélection");
                } else {
                    console.log("[ItemEditForm] handleImagePreview - Aucun asset dans le résultat:", result);
                }
            }
        } catch (error) {
            console.error("handleImagePreview - Erreur:", error);
            handleError(error, 'Erreur sélection photo', {
                source: 'item_edit_form_image_preview',
                message: `Échec de la sélection de la photo pour l'article ${adaptedItem.id}`,
                showAlert: true
            });
        }
    }, [adaptedItem.id, validatePhoto]);

    const handleSubmit = useCallback(async () => {
        console.log("[ItemEditForm] handleSubmit - Début de la sauvegarde");

        if (!hasFormChanged) {
            console.log("[ItemEditForm] handleSubmit - Aucune modification détectée");
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
            categoryId: editedItem.categoryId
        };

        if (finalPhotoStorageUrl !== undefined) {
            itemToUpdateToSendToDB.photo_storage_url = finalPhotoStorageUrl;
        }

        try {
            console.log(`[ItemEditForm] handleSubmit - Mise à jour de l'article ${adaptedItem.id} dans la base de données`);
            await database.updateItem(adaptedItem.id, itemToUpdateToSendToDB);

            const updatedItem: Item = {
                ...adaptedItem,
                ...itemToUpdateToSendToDB,
                updatedAt: new Date().toISOString()
            };

            dispatch(updateItem(updatedItem));
            await dispatch(fetchItems({ page: 0, limit: 1000 }));
            if (adaptedItem.photo_storage_url) {
                await dispatch(fetchItems({ page: 0, limit: 1000 }));
            }
            if (finalPhotoStorageUrl && typeof finalPhotoStorageUrl === 'string') {
                await dispatch(fetchItems({ page: 0, limit: 1000 }));
            }

            if (onSuccess) onSuccess();
        } catch (error) {
            console.error("[ItemEditForm] handleSubmit - Erreur lors de la mise à jour finale de la base de données:", error);
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
            console.log(`[ItemEditForm] handleConfirmDelete - Suppression optimiste de l'article ${itemId} dans Redux.`);
            dispatch(deleteItem(itemId));

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

            console.log(`[ItemEditForm] handleConfirmDelete - Suppression de l'article ${itemId} de la base de données.`);
            await database.deleteItem(itemId);
            console.log(`[ItemEditForm] handleConfirmDelete - Suppression de l'article DB réussie.`);

            console.log("[ItemEditForm] handleConfirmDelete - Invalidation des queries React Query.");
            await dispatch(fetchItems({ page: 0, limit: 1000 }));

            if (onCancel) {
                console.log("[ItemEditForm] handleConfirmDelete - Appel du callback onCancel");
                onCancel();
            }
        } catch (error) {
            console.error("[ItemEditForm] handleConfirmDelete - Erreur lors de la suppression finale de l'article:", error);
            console.warn("[ItemEditForm] handleConfirmDelete - Rollback Redux.");
            dispatch(updateItem(adaptedItem));
            handleError(error, 'Erreur lors de la suppression', {
                source: 'item_edit_form_delete_item_db',
                message: `Échec de la suppression de l'article ${adaptedItem.id}.`,
                showAlert: true
            });
        } finally {
            setConfirmDialog({ visible: false, itemId: null });
        }
    }, [confirmDialog.itemId, dispatch, adaptedItem, deletePhoto]);

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

            console.log(`[ItemEditForm] handlePhotoDelete - Mise à jour de l'article ${adaptedItem.id} dans la base de données (photo_storage_url = null).`);
            const itemToUpdateInDB: any = { photo_storage_url: null };
            await database.updateItem(adaptedItem.id, itemToUpdateInDB);

            console.log("[ItemEditForm] handlePhotoDelete - Article DB mis à jour.");

            console.log("[ItemEditForm] handlePhotoDelete - Mise à jour optimiste Redux & Invalidation caches.");
            const updatedItem: Item = {
                ...adaptedItem,
                photo_storage_url: undefined,
                updatedAt: new Date().toISOString()
            };
            dispatch(updateItem(updatedItem));

            await dispatch(fetchItems({ page: 0, limit: 1000 }));

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
    }, [adaptedItem, deletePhoto, database, dispatch, setLocalImageUri, setLocalImageNeedsUpload, setEditedItem, updateItem]);

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
                        onSelect={(id) => setEditedItem(prev => ({ ...prev, containerId: id }))}
                        onAddNew={navigateToAddContainer}
                        theme={activeTheme}
                    />
                </View>

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

                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={[styles.button, styles.generateLabelButton]}
                        onPress={() => setShowLabelGenerator(true)}
                    >
                        <Icon name="receipt" size={20} color="#fff" style={styles.buttonIcon} />
                        <Text style={styles.buttonText}>Générer Étiquette</Text>
                    </TouchableOpacity>

                    {showLabelGenerator && adaptedItem && (
                        <View style={styles.labelGeneratorContainer}>
                            <LabelGenerator
                                items={[{
                                    id: adaptedItem.id,
                                    name: adaptedItem.name,
                                    qrCode: adaptedItem.qrCode || `ITEM-${adaptedItem.id}`,
                                    sellingPrice: adaptedItem.sellingPrice,
                                    description: adaptedItem.description,
                                }]}
                                onComplete={() => {
                                    Alert.alert('Succès', 'Étiquette PDF générée.');
                                    setShowLabelGenerator(false);
                                }}
                                onError={(err) => {
                                    console.error('Error generating label:', err);
                                    Alert.alert('Erreur', 'Impossible de générer l\'étiquette: ' + err.message);
                                    setShowLabelGenerator(false);
                                }}
                                mode="items"
                            />
                        </View>
                    )}
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
    actionsContainer: {
        marginTop: 16,
        marginBottom: 12,
        gap: 12,
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
    generateLabelButton: {
        backgroundColor: '#6c5ce7',
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
    labelGeneratorContainer: {
        marginTop: 10,
        marginBottom: 0,
        padding: 10,
        backgroundColor: theme.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.border,
    },
});