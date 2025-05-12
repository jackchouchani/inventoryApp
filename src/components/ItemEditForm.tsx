import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Platform, ActivityIndicator, Image } from 'react-native';
import { useDispatch } from 'react-redux';
import { database, Category, Container } from '../database/database';
import { MaterialIcons } from '@expo/vector-icons';
import { deleteItem, updateItem } from '../store/itemsActions';
import { useQueryClient } from '@tanstack/react-query';
import type { MaterialIconName } from '../types/icons';
import type { Item, ItemUpdate } from '../types/item';
import AdaptiveImage from './AdaptiveImage';
import { validatePrice, validateItemName } from '../utils/validation';
import { handleError } from '../utils/errorHandler';
import { checkPhotoPermissions } from '../utils/permissions';
import { usePhoto } from '../hooks/usePhoto';
import { supabase } from '../config/supabase';
import * as ExpoImagePicker from 'expo-image-picker';
import ConfirmationDialog from './ConfirmationDialog';
import { useRouter } from 'expo-router';
import { theme } from '../utils/theme';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { ImagePicker } from './ImagePicker';
import { downloadImageWithS3Auth, extractFilenameFromUrl } from '../utils/s3AuthClient';
import { SUPABASE_CONFIG } from '../config/supabaseConfig';

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

// Composant mémorisé pour l'option de container
const ContainerOption = memo(({ 
    container, 
    isSelected, 
    onSelect 
}: { 
    container: Container; 
    isSelected: boolean; 
    onSelect: () => void;
}) => (
    <TouchableOpacity
        style={[styles.option, isSelected && styles.optionSelected]}
        onPress={onSelect}
    >
        <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
            {container.name}
        </Text>
    </TouchableOpacity>
));

// Composant mémorisé pour l'option de catégorie
const CategoryOption = memo(({ 
    category, 
    isSelected, 
    onSelect 
}: { 
    category: Category; 
    isSelected: boolean; 
    onSelect: () => void;
}) => (
    <TouchableOpacity
        style={[styles.option, isSelected && styles.optionSelected]}
        onPress={onSelect}
    >
        <MaterialIcons
            name={(category.icon as MaterialIconName) || 'folder'}
            size={20}
            color={isSelected ? '#fff' : '#666'}
            style={styles.categoryIcon}
        />
        <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
            {category.name}
        </Text>
    </TouchableOpacity>
));

// Ajout des composants pour les listes de containers et catégories
const ContainerList = memo(({ 
    containers, 
    selectedId, 
    onSelect,
    onAddNew 
}: { 
    containers: Container[];
    selectedId?: number | null;
    onSelect: (id: number) => void;
    onAddNew: () => void;
}) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScrollView}>
        <View style={styles.optionsContainer}>
            {containers.map((container) => (
                <ContainerOption
                    key={container.id}
                    container={container}
                    isSelected={selectedId === container.id}
                    onSelect={() => onSelect(container.id)}
                />
            ))}
            <TouchableOpacity
                style={styles.addNewOption}
                onPress={onAddNew}
            >
                <MaterialIcons
                    name="add-circle"
                    size={20}
                    color="#007AFF"
                    style={styles.addIcon}
                />
                <Text style={styles.addNewText}>Ajouter un container</Text>
            </TouchableOpacity>
        </View>
    </ScrollView>
));

// Composant pour la liste de catégories
const CategoryList = memo(({ 
    categories, 
    selectedId, 
    onSelect,
    onAddNew 
}: { 
    categories: Category[];
    selectedId?: number | null;
    onSelect: (id: number) => void;
    onAddNew: () => void;
}) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScrollView}>
        <View style={styles.optionsContainer}>
            {categories.map((category) => (
                <CategoryOption
                    key={category.id}
                    category={category}
                    isSelected={selectedId === category.id}
                    onSelect={() => onSelect(category.id)}
                />
            ))}
            <TouchableOpacity
                style={styles.addNewOption}
                onPress={onAddNew}
            >
                <MaterialIcons
                    name="add-circle"
                    size={20}
                    color="#007AFF"
                    style={styles.addIcon}
                />
                <Text style={styles.addNewText}>Ajouter une catégorie</Text>
            </TouchableOpacity>
        </View>
    </ScrollView>
));

// Fonction pour comparer les props et éviter les re-renders inutiles
const arePropsEqual = (prevProps: ItemEditFormProps, nextProps: ItemEditFormProps) => {
    return (
        prevProps.item.id === nextProps.item.id &&
        prevProps.item.description === nextProps.item.description &&
        prevProps.item.updatedAt === nextProps.item.updatedAt &&
        prevProps.categories.length === nextProps.categories.length &&
        prevProps.containers.length === nextProps.containers.length
    );
};

export const ItemEditForm = memo(({ item, containers: propContainers, categories: propCategories, onSuccess, onCancel }) => {
    // console.log("[ItemEditForm] Received item prop:", JSON.stringify(item, null, 2)); // <-- RETRAIT DU DIAGNOSTIC
    
    // S'assurer que les containers et catégories sont des tableaux valides
    const containers = Array.isArray(propContainers) ? propContainers : [];
    const categories = Array.isArray(propCategories) ? propCategories : [];
    
    const dispatch = useDispatch();
    const queryClient = useQueryClient();
    const { uploadPhoto, deletePhoto, compressImage } = usePhoto();
    const router = useRouter();

    // État pour tracker si l'image a été modifiée et doit être uploadée
    const [localImage, setLocalImage] = useState<{ uri: string; needsUpload: boolean } | null>(null);
    // Ajout d'un état pour suivre l'upload en cours
    const [isUploading, setIsUploading] = useState(false);
    // Nouvel état pour gérer l'URL directe de l'image pour l'affichage
    const [displayImageUri, setDisplayImageUri] = useState<string | null>(null);
    // État pour gérer les erreurs d'image
    const [imageError, setImageError] = useState<string | null>(null);
    // État pour le chargement de l'image
    const [isImageLoading, setIsImageLoading] = useState(false);

    // État pour la boîte de dialogue de confirmation de suppression
    const [confirmDialog, setConfirmDialog] = useState<{
        visible: boolean;
        itemId: number | null;
    }>({
        visible: false,
        itemId: null
    });

    // Initialisation de l'état du formulaire
    const [editedItem, setEditedItem] = useState<EditedItemForm>({
        name: item.name,
        description: item.description || '',
        purchasePrice: item.purchasePrice.toString(),
        sellingPrice: item.sellingPrice.toString(),
        status: item.status,
        photo_storage_url: item.photo_storage_url,
        containerId: item.containerId,
        categoryId: item.categoryId
    });

    const initialFormState = useMemo(() => ({
        name: item.name,
        description: item.description || '',
        purchasePrice: item.purchasePrice.toString(),
        sellingPrice: item.sellingPrice.toString(),
        status: item.status,
        photo_storage_url: item.photo_storage_url,
        containerId: item.containerId,
        categoryId: item.categoryId
    }), [item]);

    useEffect(() => {
        setEditedItem(initialFormState);
    }, [initialFormState]);

    const handlePriceChange = useCallback((field: 'purchasePrice' | 'sellingPrice', text: string) => {
        const cleanText = text.replace(',', '.');
        if (cleanText === '' || /^\d*\.?\d*$/.test(cleanText)) {
            setEditedItem(prev => ({ ...prev, [field]: cleanText }));
        }
    }, []);

    const validateForm = useCallback((): boolean => {
        try {
            if (!validateItemName(editedItem.name)) {
                Alert.alert('Erreur', 'Le nom de l\'article est invalide');
                return false;
            }

            const purchasePrice = parseFloat(editedItem.purchasePrice);
            const sellingPrice = parseFloat(editedItem.sellingPrice);

            if (!validatePrice(purchasePrice) || !validatePrice(sellingPrice)) {
                Alert.alert('Erreur', 'Les prix doivent être des nombres valides');
                return false;
            }

            if (sellingPrice < purchasePrice) {
                Alert.alert('Attention', 'Le prix de vente est inférieur au prix d\'achat');
                return false;
            }

            return true;
        } catch (error) {
            handleError(error, 'Erreur de validation du formulaire', {
                source: 'item_edit_form_validation',
                message: `Erreur lors de la validation de l'article ${item.id}`
            });
            return false;
        }
    }, [editedItem, item.id]);

    // Modification de la fonction handleImagePreview pour gérer spécifiquement Safari iOS
    const handleImagePreview = useCallback(async () => {
        try {
            const hasPermissions = await checkPhotoPermissions();
            if (!hasPermissions) {
                console.error("handleImagePreview - Permission refusée");
                Alert.alert('Erreur', 'Permission d\'accès aux photos refusée');
                return;
            }
            
            // Utiliser ImagePicker pour sélectionner une image
            const result = await ExpoImagePicker.launchImageLibraryAsync({
                mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.7, // Augmenter légèrement la qualité pour Safari iOS
                base64: true, // Toujours demander le base64
                exif: false, // Ignorer les métadonnées EXIF pour réduire la taille
            });
            
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const selectedAsset = result.assets[0];
                
                if (Platform.OS === 'web') {
                    // Pour le web, toujours privilégier le format base64
                    if (selectedAsset.base64) {
                        const mimeType = selectedAsset.mimeType || 'image/jpeg';
                        const base64Uri = `data:${mimeType};base64,${selectedAsset.base64}`;
                        
                        // Vérifier la taille approximative
                        const base64Size = (selectedAsset.base64.length * 3) / 4;
                        console.log(`handleImagePreview - Taille approximative: ${(base64Size/1024/1024).toFixed(2)}MB`);
                        
                        // Toujours compresser les images sur Safari iOS pour éviter les problèmes
                        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
                        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                        
                        if (isSafari || isIOS || base64Size > (512 * 1024)) { // Compresser systématiquement sur Safari/iOS ou si > 512KB
                            console.log("handleImagePreview - Safari iOS détecté ou image large, compression en cours");
                            try {
                                const compressedUri = await compressImage(base64Uri);
                                console.log("handleImagePreview - Compression réussie");
                                setLocalImage({ uri: compressedUri, needsUpload: true });
                                return;
                            } catch (compressError) {
                                console.error("handleImagePreview - Erreur de compression:", compressError);
                                // En cas d'échec, continuer avec l'URI original tout en notifiant l'utilisateur
                                Alert.alert(
                                    'Avertissement', 
                                    'La compression de l\'image a échoué, ce qui pourrait causer des problèmes lors de l\'enregistrement. Essayez avec une image plus petite.'
                                );
                            }
                        }
                        
                        // Stocker directement l'URI base64 pour la prévisualisation et l'upload
                        setLocalImage({ uri: base64Uri, needsUpload: true });
                    } else {
                        console.error("handleImagePreview - Impossible d'obtenir l'image en base64");
                        Alert.alert('Erreur', 'Impossible d\'obtenir l\'image en format compatible');
                    }
                } else {
                    // Sur les plateformes natives, on utilise l'URI standard
                    setLocalImage({ uri: selectedAsset.uri, needsUpload: true });
                }
            }
        } catch (error) {
            console.error("handleImagePreview - Erreur:", error);
            handleError(error, 'Erreur lors de la prévisualisation de la photo', {
                source: 'item_edit_form_image_preview',
                message: `Échec de la prévisualisation de la photo pour l'article ${item.id}`,
                showAlert: true
            });
        }
    }, [item.id, compressImage]);

    // Mise à jour pour utiliser usePhoto au lieu de faire notre propre compression/upload
    const handlePhotoUpload = async (uri: string): Promise<string | null> => {
        try {
            setIsUploading(true);
            
            // Créer un nom de fichier identifiant qui inclut l'ID de l'article
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2, 8);
            const fileName = `item_${item.id}_${timestamp}_${randomId}.jpg`;
            
            // Uploader avec notre système qui compresse déjà automatiquement
            const uploadedUrl = await uploadPhoto(uri, true, fileName);
            
            setIsUploading(false);
            return uploadedUrl;
        } catch (error) {
            console.error("handlePhotoUpload - Erreur:", error);
            Alert.alert(
                'Erreur',
                error instanceof Error ? error.message : 'Erreur lors de l\'upload de la photo'
            );
            setIsUploading(false);
            return null;
        }
    };

    // Fonction pour vérifier si le formulaire a été modifié
    const hasFormChanged = useMemo(() => {
        // Vérifier si l'image a été modifiée
        const imageChanged = 
            (localImage && localImage.needsUpload) || 
            (initialFormState.photo_storage_url !== editedItem.photo_storage_url);
            
        // Vérifier si d'autres champs ont été modifiés
        const otherFieldsChanged = 
            initialFormState.name !== editedItem.name ||
            initialFormState.description !== editedItem.description ||
            initialFormState.purchasePrice !== editedItem.purchasePrice ||
            initialFormState.sellingPrice !== editedItem.sellingPrice ||
            initialFormState.status !== editedItem.status ||
            initialFormState.containerId !== editedItem.containerId ||
            initialFormState.categoryId !== editedItem.categoryId;
            
        return imageChanged || otherFieldsChanged;
    }, [initialFormState, editedItem, localImage]);

    // Nouvelle fonction pour charger l'image depuis Supabase
    useEffect(() => {
        if (editedItem.photo_storage_url && !localImage) {
            setIsImageLoading(true);
            setImageError(null);
            
            console.log(`[ItemEditForm] Chargement de l'image: ${editedItem.photo_storage_url}`);
            
            downloadImageWithS3Auth(editedItem.photo_storage_url)
                .then(uri => {
                    if (uri) {
                        console.log(`[ItemEditForm] Image chargée avec succès: ${uri.substring(0, 50)}...`);
                        setDisplayImageUri(uri);
                    } else {
                        throw new Error('Échec de récupération de l\'image');
                    }
                })
                .catch(err => {
                    console.error(`[ItemEditForm] Erreur lors du chargement de l'image:`, err);
                    
                    // Tentative de fallback: essayer de récupérer juste le nom du fichier
                    const filenameOrEmpty = extractFilenameFromUrl(editedItem.photo_storage_url || '');
                    if (filenameOrEmpty && filenameOrEmpty.length > 0) {
                        // Essayer d'utiliser directement l'URL publique
                        const publicUrl = `https://lixpixyyszvcuwpcgmxe.supabase.co/storage/v1/object/public/${SUPABASE_CONFIG.STORAGE.BUCKETS.PHOTOS}/${filenameOrEmpty}`;
                        console.log(`[ItemEditForm] Tentative avec URL publique: ${publicUrl.substring(0, 50)}...`);
                        setDisplayImageUri(publicUrl);
                    } else {
                        setImageError(`Erreur: ${err.message || 'Problème de chargement'}`);
                    }
                })
                .finally(() => {
                    setIsImageLoading(false);
                });
        } else if (localImage) {
            // Si nous avons une image locale, l'utiliser pour l'affichage
            setDisplayImageUri(localImage.uri);
            setImageError(null);
        } else {
            // Pas d'image à afficher
            setDisplayImageUri(null);
            setImageError(null);
        }
    }, [editedItem.photo_storage_url, localImage]);

    // Modification du handleSubmit pour vérifier l'accessibilité des images
    const handleSubmit = useCallback(async () => {
        try {
            console.log("[ItemEditForm] handleSubmit - Début de la sauvegarde");
            
            // Vérifier si le formulaire a été modifié
            if (!hasFormChanged) {
                console.log("[ItemEditForm] handleSubmit - Aucune modification détectée");
                Alert.alert('Information', 'Aucune modification à enregistrer');
                return;
            }
            
            console.log("[ItemEditForm] handleSubmit - Formulaire modifié, validation en cours");
            
            if (!validateForm()) {
                console.log("[ItemEditForm] handleSubmit - Échec de la validation du formulaire");
                return;
            }

            if (!item.id) {
                console.error("[ItemEditForm] handleSubmit - ID de l'article manquant");
                throw new Error('ID de l\'article manquant');
            }

            console.log(`[ItemEditForm] handleSubmit - Validation OK, traitement de l'article ${item.id}`);

            // Si nous avons une image locale qui doit être uploadée
            let photoStorageUrl = editedItem.photo_storage_url;
            
            if (localImage && localImage.needsUpload) {
                console.log("[ItemEditForm] handleSubmit - Upload d'image nécessaire");
                
                // Afficher un indicateur de chargement
                setIsUploading(true);
                
                console.log(`[ItemEditForm] handleSubmit - Début de l'upload de l'image: ${localImage.uri.substring(0, 50)}...`);
                const uploadedUrl = await handlePhotoUpload(localImage.uri);
                
                if (uploadedUrl) {
                    console.log(`[ItemEditForm] handleSubmit - Upload réussi: ${uploadedUrl.substring(0, 50)}...`);
                    photoStorageUrl = uploadedUrl;
                    
                    // Vérifier immédiatement si l'URL est accessible
                    if (Platform.OS === 'web') {
                        try {
                            const response = await fetch(uploadedUrl, { method: 'HEAD' });
                            if (response.ok) {
                                console.log(`[ItemEditForm] handleSubmit - L'URL d'image est accessible`);
                            } else {
                                console.warn(`[ItemEditForm] handleSubmit - L'URL d'image n'est pas accessible: ${response.status} ${response.statusText}`);
                                // Continuer quand même, car l'URL peut devenir accessible plus tard
                            }
                        } catch (verifyError) {
                            console.warn("[ItemEditForm] handleSubmit - Impossible de vérifier l'accessibilité de l'URL:", verifyError);
                            // Continuer malgré l'erreur
                        }
                    }
                } else {
                    console.error("[ItemEditForm] handleSubmit - Échec de l'upload de l'image pendant la sauvegarde");
                    Alert.alert('Attention', "L'article sera sauvegardé sans l'image");
                    // En cas d'échec, on garde l'ancienne URL si elle existe
                    photoStorageUrl = item.photo_storage_url;
                }
            } else {
                console.log("[ItemEditForm] handleSubmit - Pas d'upload d'image nécessaire");
            }

            // Vérifiez si l'image a été supprimée dans l'interface
            const imageWasDeleted = item.photo_storage_url && photoStorageUrl === null;
            
            if (imageWasDeleted && item.photo_storage_url) {
                console.log(`[ItemEditForm] handleSubmit - Suppression de l'ancienne image: ${item.photo_storage_url.substring(0, 50)}...`);
                try {
                    await deletePhoto(item.photo_storage_url);
                    console.log("[ItemEditForm] handleSubmit - Suppression de l'image réussie");
                } catch (photoError) {
                    console.error('[ItemEditForm] handleSubmit - Échec de la suppression de l\'image du stockage:', photoError);
                }
            }

            console.log("[ItemEditForm] handleSubmit - Préparation des données pour la mise à jour");
            const purchasePrice = parseFloat(editedItem.purchasePrice);
            const sellingPrice = parseFloat(editedItem.sellingPrice);

            // Pour la mise à jour de l'item, utiliser explicitement undefined ou l'URL
            const itemToUpdate: ItemUpdate = {
                name: editedItem.name,
                description: editedItem.description,
                purchasePrice,
                sellingPrice,
                status: editedItem.status,
                photo_storage_url: imageWasDeleted ? undefined : photoStorageUrl || undefined,
                containerId: editedItem.containerId,
                categoryId: editedItem.categoryId
            };

            console.log("[ItemEditForm] handleSubmit - Données prêtes", JSON.stringify(itemToUpdate, null, 2));

            try {
                // Mise à jour explicite pour NULL si l'image a été supprimée
                if (imageWasDeleted) {
                    console.log("[ItemEditForm] handleSubmit - Mise à jour explicite à NULL pour l'image supprimée");
                    
                    const { error: explicitUpdateError } = await supabase
                        .from('items')
                        .update({ photo_storage_url: null })
                        .eq('id', item.id);
                    
                    if (explicitUpdateError) {
                        console.error("[ItemEditForm] handleSubmit - Erreur lors de la mise à jour explicite:", explicitUpdateError);
                        throw explicitUpdateError;
                    }
                }
                
                console.log(`[ItemEditForm] handleSubmit - Mise à jour de l'article ${item.id} dans la base de données`);
                // Mise à jour normale pour tous les autres cas
                await database.updateItem(item.id, itemToUpdate);
                
                console.log("[ItemEditForm] handleSubmit - Mise à jour optimiste dans Redux");
                // Mise à jour optimiste
                const updatedItem: Item = {
                    ...item,
                    ...itemToUpdate,
                    updatedAt: new Date().toISOString()
                };
                
                dispatch(updateItem(updatedItem));
                
                console.log("[ItemEditForm] handleSubmit - Invalidation des queries");
                // Mise à jour des queries
                queryClient.invalidateQueries({ queryKey: ['items'] });
                queryClient.invalidateQueries({ queryKey: ['inventory'] });

                // Réinitialiser l'état local
                setLocalImage(null);
                setIsUploading(false);

                console.log("[ItemEditForm] handleSubmit - Sauvegarde terminée avec succès");
                if (onSuccess) {
                    console.log("[ItemEditForm] handleSubmit - Appel du callback onSuccess");
                    onSuccess();
                }
            } catch (error) {
                console.error("[ItemEditForm] handleSubmit - Erreur lors de la mise à jour de la base de données:", error);
                handleError(error, 'Erreur lors de la mise à jour', {
                    source: 'item_edit_form_update',
                    message: `Échec de la mise à jour de l'article ${item.id}`,
                    showAlert: true
                });
                setIsUploading(false);
            }
        } catch (error) {
            console.error("[ItemEditForm] handleSubmit - Erreur générale:", error);
            handleError(error, 'Erreur lors de la mise à jour', {
                source: 'item_edit_form_update',
                message: `Erreur générale lors de la mise à jour de l'article ${item.id}`,
                showAlert: true
            });
            setIsUploading(false);
        }
    }, [editedItem, item, validateForm, deletePhoto, dispatch, onSuccess, queryClient, localImage, handlePhotoUpload, hasFormChanged]);

    const handleDelete = useCallback(async () => {
        if (!item.id) return;

        // Afficher la boîte de dialogue de confirmation
        setConfirmDialog({
            visible: true,
            itemId: item.id
        });
    }, [item.id]);

    // Fonction pour gérer la confirmation de suppression
    const handleConfirmDelete = useCallback(async () => {
        const itemId = confirmDialog.itemId;
        if (!itemId) return;
        
        try {
            // Suppression optimiste
            dispatch(deleteItem(itemId));
            
            try {
                await database.deleteItem(itemId);
                queryClient.invalidateQueries({ queryKey: ['items'] });
                queryClient.invalidateQueries({ queryKey: ['inventory'] });
                if (onCancel) onCancel();
            } catch (error) {
                // Rollback en cas d'erreur
                dispatch(updateItem(item));
                handleError(error, 'Erreur lors de la suppression', {
                    source: 'item_edit_form_delete',
                    message: `Échec de la suppression de l'article ${item.id}`,
                    showAlert: true
                });
            }
        } catch (error) {
            handleError(error, 'Erreur lors de la suppression', {
                source: 'item_edit_form_delete',
                message: `Erreur générale lors de la suppression de l'article ${item.id}`,
                showAlert: true
            });
        } finally {
            // Fermer la boîte de dialogue
            setConfirmDialog({ visible: false, itemId: null });
        }
    }, [confirmDialog.itemId, dispatch, item, queryClient, onCancel]);

    // Fonction pour annuler la suppression
    const handleCancelDelete = useCallback(() => {
        setConfirmDialog({ visible: false, itemId: null });
    }, []);

    const handlePhotoDelete = useCallback(async () => {
        try {
            // On ne supprime pas l'image du stockage ici, on la supprimera lors de la sauvegarde
            // On met juste à jour l'état local pour retirer visuellement l'image
            
            // Réinitialiser l'image locale
            setLocalImage(null);
            
            // Utiliser null pour indiquer explicitement que l'image a été supprimée
            setEditedItem(prev => ({ ...prev, photo_storage_url: null }));
            
            // Mise à jour optimiste de Redux pour refléter immédiatement le changement
            // dans l'interface utilisateur
            if (item.id) {
                // Pour Redux, on utilise undefined pour être compatible avec le type Item
                const updatedItem: Item = {
                    ...item,
                    photo_storage_url: undefined,
                    updatedAt: new Date().toISOString()
                };
                
                dispatch(updateItem(updatedItem));
                
                // Noter que l'image a été supprimée visuellement mais pas encore dans la base de données
            }
        } catch (error) {
            handleError(error, 'Erreur lors de la suppression de la photo', {
                source: 'item_edit_form_image',
                message: `Échec de la suppression de la photo de l'article ${item.id}`,
                showAlert: true
            });
        }
    }, [item, dispatch]);

    // Remplacer les fonctions d'ajout direct par redirection vers les formulaires existants
    const navigateToAddContainer = useCallback(() => {
        // Enregistrer l'état actuel du formulaire dans queryClient pour le récupérer ensuite
        queryClient.setQueryData(['temp_edit_form_state', item.id], editedItem);
        
        // Naviguer vers le formulaire de container
        router.push('/containers');
        
        // Note: On ne peut pas utiliser addListener avec Expo Router
        // On utilisera useEffect pour rafraîchir les données lorsqu'on revient à cet écran
    }, [router, queryClient, item.id, editedItem]);

    const navigateToAddCategory = useCallback(() => {
        // Enregistrer l'état actuel du formulaire dans queryClient
        queryClient.setQueryData(['temp_edit_form_state', item.id], editedItem);
        
        // Naviguer vers le formulaire de catégorie
        router.push('/add-category');
        
        // Note: On ne peut pas utiliser addListener avec Expo Router
        // On utilisera useEffect pour rafraîchir les données lorsqu'on revient à cet écran
    }, [router, queryClient, item.id, editedItem]);

    // Ajouter un effet pour rafraîchir les données lorsqu'on revient à cet écran
    useEffect(() => {
        // Rafraîchir les données des containers et catégories
        queryClient.invalidateQueries({ queryKey: ['containers'] });
        queryClient.invalidateQueries({ queryKey: ['categories'] });
        
        // Récupérer le dernier container ajouté
        const fetchedContainers = queryClient.getQueryData<Container[]>(['containers']);
        if (fetchedContainers && fetchedContainers.length > 0) {
            // Trier par date de création pour obtenir le plus récent
            const sortedContainers = [...fetchedContainers].sort((a, b) => 
                new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
            );
            
            // Si notre container actuel n'est pas défini, sélectionner automatiquement le plus récent
            if (!editedItem.containerId) {
                setEditedItem(prev => ({ ...prev, containerId: sortedContainers[0].id }));
            }
        }
        
        // Récupérer la dernière catégorie ajoutée
        const fetchedCategories = queryClient.getQueryData<Category[]>(['categories']);
        if (fetchedCategories && fetchedCategories.length > 0) {
            // Trier par date de création pour obtenir la plus récente
            const sortedCategories = [...fetchedCategories].sort((a, b) => 
                new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
            );
            
            // Si notre catégorie actuelle n'est pas définie, sélectionner automatiquement la plus récente
            if (!editedItem.categoryId) {
                setEditedItem(prev => ({ ...prev, categoryId: sortedCategories[0].id }));
            }
        }
    }, [queryClient, editedItem.containerId, editedItem.categoryId]);

    return (
        <ScrollView style={styles.container}>
            <View style={styles.contentContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Nom de l'article"
                    value={editedItem.name}
                    onChangeText={(text) => setEditedItem(prev => ({ ...prev, name: text }))}
                />

                <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Description de l'article"
                    value={editedItem.description}
                    onChangeText={(text) => setEditedItem(prev => ({ ...prev, description: text }))}
                    multiline
                    numberOfLines={4}
                />

                <View style={styles.priceContainer}>
                    <View style={styles.priceInputWrapper}>
                        <Text style={styles.priceLabel}>Prix d'achat (€)</Text>
                        <TextInput
                            style={[styles.input, styles.priceInput]}
                            placeholder="0.00"
                            value={editedItem.purchasePrice}
                            keyboardType="decimal-pad"
                            onChangeText={(text) => handlePriceChange('purchasePrice', text)}
                        />
                    </View>
                    <View style={styles.priceInputWrapper}>
                        <Text style={styles.priceLabel}>Prix de vente (€)</Text>
                        <TextInput
                            style={[styles.input, styles.priceInput]}
                            placeholder="0.00"
                            value={editedItem.sellingPrice}
                            keyboardType="decimal-pad"
                            onChangeText={(text) => handlePriceChange('sellingPrice', text)}
                        />
                    </View>
                </View>

                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Photo</Text>
                    <View style={styles.imageContainer}>
                        {displayImageUri || isImageLoading ? (
                            <View style={styles.imageWrapper}>
                                {isImageLoading ? (
                                    <View style={[styles.image, styles.imagePlaceholder]}>
                                        <ActivityIndicator size="small" color="#007AFF" />
                                        <Text style={styles.loadingText}>Chargement...</Text>
                                    </View>
                                ) : imageError ? (
                                    <View style={[styles.image, styles.errorImagePlaceholder]}>
                                        <MaterialIcons name="error-outline" size={24} color="#e53935" />
                                        <Text style={styles.errorText}>Erreur de chargement</Text>
                                    </View>
                                ) : (
                                    <Image 
                                        source={{ uri: displayImageUri! }}
                                        style={styles.image}
                                        resizeMode="cover"
                                        onError={(e) => {
                                            console.error(`[ItemEditForm] Erreur de rendu d'image:`, e.nativeEvent.error);
                                            setImageError(`Erreur de rendu: ${e.nativeEvent.error}`);
                                        }}
                                    />
                                )}
                                <View style={styles.imageActions}>
                                    <TouchableOpacity 
                                        style={styles.imageActionButton}
                                        onPress={handleImagePreview}
                                        disabled={isUploading}
                                    >
                                        <MaterialIcons name="edit" size={24} color={isUploading ? "#cccccc" : "#007AFF"} />
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={styles.imageActionButton}
                                        onPress={handlePhotoDelete}
                                        disabled={isUploading}
                                    >
                                        <MaterialIcons name="delete" size={24} color={isUploading ? "#cccccc" : "#FF3B30"} />
                                    </TouchableOpacity>
                                </View>
                                {localImage?.needsUpload && (
                                    <View style={styles.newImageBadge}>
                                        <MaterialIcons name="cloud-upload" size={14} color="#FFFFFF" />
                                        <Text style={styles.newImageText}>En attente d'upload</Text>
                                    </View>
                                )}
                                {isUploading && (
                                    <View style={styles.uploadingOverlay}>
                                        <MaterialIcons name="cloud-upload" size={32} color="#FFFFFF" />
                                        <Text style={styles.uploadingText}>Upload en cours...</Text>
                                    </View>
                                )}
                            </View>
                        ) : (
                            <TouchableOpacity 
                                style={styles.imagePicker}
                                onPress={handleImagePreview}
                                disabled={isUploading}
                            >
                                <MaterialIcons name="add-photo-alternate" size={48} color={isUploading ? "#cccccc" : "#007AFF"} />
                                <Text style={[styles.imagePickerText, isUploading && {color: "#cccccc"}]}>
                                    {isUploading ? "Upload en cours..." : "Sélectionner une image"}
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
                    />
                </View>

                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Catégorie</Text>
                    <CategoryList
                        categories={categories}
                        selectedId={editedItem.categoryId}
                        onSelect={(id) => setEditedItem(prev => ({ ...prev, categoryId: id }))}
                        onAddNew={navigateToAddCategory}
                    />
                </View>

                <View style={styles.buttonContainer}>
                    <TouchableOpacity 
                        style={[styles.deleteButton, isUploading && styles.disabledButton]} 
                        onPress={handleDelete}
                        disabled={isUploading}
                    >
                        <MaterialIcons name="delete" size={20} color="#fff" />
                        <Text style={styles.buttonText}>Supprimer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.cancelButton, isUploading && styles.disabledButton]} 
                        onPress={onCancel}
                        disabled={isUploading}
                    >
                        <Text style={styles.buttonText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[
                            styles.saveButton,
                            !hasFormChanged || isUploading ? styles.disabledButton : null,
                            localImage?.needsUpload && !isUploading ? styles.uploadButton : null
                        ]} 
                        onPress={() => {
                            console.log("[ItemEditForm] Bouton de sauvegarde cliqué");
                            handleSubmit();
                        }}
                        disabled={!hasFormChanged || isUploading}
                    >
                        {localImage?.needsUpload && !isUploading ? (
                            <>
                                <MaterialIcons name="cloud-upload" size={20} color="#fff" />
                                <Text style={styles.buttonText}>Uploader & Sauvegarder</Text>
                            </>
                        ) : isUploading ? (
                            <Text style={styles.buttonText}>Upload en cours...</Text>
                        ) : (
                            <Text style={styles.buttonText}>Mettre à jour</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Ajouter le dialogue de confirmation */}
            <ConfirmationDialog
                visible={confirmDialog.visible}
                title="Confirmation de suppression"
                message="Êtes-vous sûr de vouloir supprimer cet article ?"
                confirmText="Supprimer"
                cancelText="Annuler"
                confirmButtonStyle="destructive"
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
            />
        </ScrollView>
    );
}, arePropsEqual);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    contentContainer: {
        padding: 16,
    },
    input: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        fontSize: 16,
        color: '#000',
        borderWidth: 1,
        borderColor: '#e5e5e5',
        elevation: 0,
    },
    textArea: {
        height: 120,
        textAlignVertical: 'top',
    },
    priceContainer: {
        flexDirection: 'column',
        gap: 12,
        marginBottom: 16,
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    priceInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 10,
    },
    priceLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        width: '40%',
    },
    priceInput: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 6,
        padding: 8,
        textAlign: 'right',
        fontSize: 16,
        color: '#007AFF',
        fontWeight: '600',
        marginBottom: 0,
    },
    imageContainer: {
        marginTop: 8,
    },
    imageWrapper: {
        aspectRatio: 4/3,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e5e5e5',
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
    },
    sectionContainer: {
        marginBottom: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
        color: '#333',
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
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e5e5e5',
    },
    optionSelected: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    optionText: {
        fontSize: 14,
        color: '#333',
    },
    optionTextSelected: {
        color: '#fff',
        fontWeight: '500',
    },
    categoryIcon: {
        marginRight: 8,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    saveButton: {
        flex: 1,
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    uploadButton: {
        backgroundColor: '#4CD964',
    },
    disabledButton: {
        backgroundColor: '#CCCCCC',
        opacity: 0.7,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#8E8E93',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    deleteButton: {
        flex: 1,
        backgroundColor: '#FF3B30',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    noDataText: {
        color: '#666',
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
        backgroundColor: '#007AFF',
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
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imagePickerText: {
        marginTop: 8,
        color: '#007AFF',
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
        backgroundColor: '#e6f2ff',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#007AFF',
    },
    addNewText: {
        fontSize: 14,
        color: '#007AFF',
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
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        width: '100%',
        maxWidth: 500,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#000',
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
        backgroundColor: '#007AFF',
    },
    modalButtonCancel: {
        backgroundColor: '#8E8E93',
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
        color: '#333',
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
        backgroundColor: '#f5f5f5',
    },
    iconOptionSelected: {
        backgroundColor: '#007AFF',
    },
    imagePlaceholder: {
        backgroundColor: '#f8f9fa',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#007AFF',
        fontSize: 14,
        marginTop: 4,
        textAlign: 'center',
    },
    errorImagePlaceholder: {
        backgroundColor: '#ffeeee',
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: '#e53935',
        fontSize: 14,
        marginTop: 4,
        textAlign: 'center',
    },
});