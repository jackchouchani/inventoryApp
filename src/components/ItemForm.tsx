import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useDispatch } from 'react-redux';
import { database, Category, Container } from '../database/database';
import { useRefreshStore } from '../store/refreshStore';
import { generateId } from '../utils/identifierManager';
import { addItem } from '../store/itemsActions';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import type { MaterialIconName } from '../types/icons';
import { ImagePicker } from './ImagePicker';
import * as Sentry from '@sentry/react-native';
import AdaptiveImage from './AdaptiveImage';
import { handleError } from '../utils/errorHandler';
import { ErrorBoundary } from '../components/ErrorBoundary';
import type { FallbackProps } from 'react-error-boundary';
import type { Item, ItemInput } from '../types/item';
import { usePhoto } from '../hooks/usePhoto';

const FORM_VALIDATION = {
    NAME_MAX_LENGTH: 100,
    MIN_PRICE: 0,
    MAX_PRICE: 1000000,
    REQUIRED_FIELDS: ['name', 'categoryId'] as const
} as const;

/**
 * Type pour les erreurs de validation du formulaire
 */
type ValidationError = {
    field: string;
    message: string;
};

/**
 * Props pour le composant ContainerOption
 */
interface ContainerOptionProps {
    container: Container;
    isSelected: boolean;
    onSelect: (id: number) => void;
}

/**
 * Props pour le composant CategoryOption
 */
interface CategoryOptionProps {
    category: Category;
    isSelected: boolean;
    onSelect: (id: number) => void;
}

interface ItemFormProps {
    containers: Container[];
    categories: Category[];
    onSuccess?: () => void;
    onCancel?: () => void;
}

interface ItemFormState {
    name: string;
    description: string;
    purchasePrice: string;
    sellingPrice: string;
    status: 'available' | 'sold';
    photo_storage_url?: string;
    containerId?: number | null;
    categoryId?: number | null;
}

const INITIAL_STATE: ItemFormState = {
    name: '',
    description: '',
    purchasePrice: '',
    sellingPrice: '',
    status: 'available',
    photo_storage_url: undefined,
    containerId: null,
    categoryId: null,
};

/**
 * Composant d'option de conteneur mémoïsé
 */
const ContainerOption = memo(({ container, isSelected, onSelect }: ContainerOptionProps) => (
    <TouchableOpacity
        style={[styles.option, isSelected && styles.optionSelected]}
        onPress={() => onSelect(container.id)}
    >
        <MaterialIcons
            name="inbox"
            size={20}
            color={isSelected ? '#fff' : '#666'}
            style={styles.containerIcon}
        />
        <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
            {container.name}
        </Text>
    </TouchableOpacity>
));

/**
 * Composant d'option de catégorie mémoïsé
 */
const CategoryOption = memo(({ category, isSelected, onSelect }: CategoryOptionProps) => (
    <TouchableOpacity
        style={[styles.option, isSelected && styles.optionSelected]}
        onPress={() => onSelect(category.id)}
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

/**
 * Composant de liste de conteneurs mémoïsé
 */
const ContainerList = memo(({ containers, selectedId, onSelect }: {
    containers: Container[];
    selectedId?: number | null;
    onSelect: (id: number) => void;
}) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScrollView}>
        <View style={styles.optionsContainer}>
            {containers.map((container) => (
                <ContainerOption
                    key={container.id}
                    container={container}
                    isSelected={selectedId === container.id}
                    onSelect={onSelect}
                />
            ))}
        </View>
    </ScrollView>
));

/**
 * Composant de liste de catégories mémoïsé
 */
const CategoryList = memo(({ categories, selectedId, onSelect }: {
    categories: Category[];
    selectedId?: number | null;
    onSelect: (id: number) => void;
}) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScrollView}>
        <View style={styles.optionsContainer}>
            {categories.map((category) => (
                <CategoryOption
                    key={category.id}
                    category={category}
                    isSelected={selectedId === category.id}
                    onSelect={onSelect}
                />
            ))}
        </View>
    </ScrollView>
));

/**
 * Composant de fallback en cas d'erreur
 */
const ItemFormErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => (
    <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
            Une erreur est survenue lors du chargement du formulaire
        </Text>
        <Text style={styles.errorDetail}>{error.message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={resetErrorBoundary}>
            <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
    </View>
);

const ItemFormWithErrorBoundary: React.FC<ItemFormProps> = (props) => (
    <ErrorBoundary
        fallbackRender={ItemFormErrorFallback}
        onReset={() => {
            // Réinitialisation du formulaire si nécessaire
        }}
    >
        <ItemForm {...props} />
    </ErrorBoundary>
);

const ItemForm: React.FC<ItemFormProps> = ({ containers, categories, onSuccess, onCancel }) => {
    const dispatch = useDispatch();
    const queryClient = useQueryClient();
    const triggerRefresh = useRefreshStore(state => state.triggerRefresh);
    const [item, setItem] = useState<ItemFormState>(INITIAL_STATE);
    const { loading, error, uploadPhoto, validatePhoto } = usePhoto();

    const resetForm = useCallback(() => {
        setItem(INITIAL_STATE);
    }, []);

    useEffect(() => {
        return () => {
            resetForm();
        };
    }, [resetForm]);

    /**
     * Valide le formulaire et retourne les erreurs éventuelles
     */
    const validateForm = useCallback((): ValidationError[] => {
        const errors: ValidationError[] = [];
        
        // Validation du nom
        if (!item.name.trim()) {
            errors.push({ field: 'name', message: 'Le nom est requis' });
        } else if (item.name.length > FORM_VALIDATION.NAME_MAX_LENGTH) {
            errors.push({ 
                field: 'name', 
                message: `Le nom ne doit pas dépasser ${FORM_VALIDATION.NAME_MAX_LENGTH} caractères` 
            });
        }
        
        // Validation des prix
        const purchasePrice = parseFloat(item.purchasePrice);
        const sellingPrice = parseFloat(item.sellingPrice);
        
        if (isNaN(purchasePrice) || purchasePrice < FORM_VALIDATION.MIN_PRICE) {
            errors.push({ 
                field: 'purchasePrice', 
                message: 'Le prix d\'achat doit être un nombre positif' 
            });
        } else if (purchasePrice > FORM_VALIDATION.MAX_PRICE) {
            errors.push({ 
                field: 'purchasePrice', 
                message: `Le prix d'achat ne peut pas dépasser ${FORM_VALIDATION.MAX_PRICE}` 
            });
        }
        
        if (isNaN(sellingPrice) || sellingPrice < FORM_VALIDATION.MIN_PRICE) {
            errors.push({ 
                field: 'sellingPrice', 
                message: 'Le prix de vente doit être un nombre positif' 
            });
        } else if (sellingPrice > FORM_VALIDATION.MAX_PRICE) {
            errors.push({ 
                field: 'sellingPrice', 
                message: `Le prix de vente ne peut pas dépasser ${FORM_VALIDATION.MAX_PRICE}` 
            });
        }
        
        // Validation de la catégorie
        if (!item.categoryId) {
            errors.push({ field: 'categoryId', message: 'La catégorie est requise' });
        }
        
        return errors;
    }, [item]);

    /**
     * Mutation pour l'ajout d'un item avec React Query
     */
    const addItemMutation = useMutation({
        mutationFn: async (newItem: ItemFormState) => {
            const qrCode = generateId('ITEM');
            let photoUrl: string | undefined = undefined;

            if (newItem.photo_storage_url) {
                try {
                    photoUrl = await uploadPhoto(newItem.photo_storage_url);
                } catch (error) {
                    throw new Error('Erreur lors de l\'upload de la photo');
                }
            }

            if (!newItem.categoryId) {
                throw new Error('La catégorie est requise');
            }

            const itemToAdd: ItemInput = {
                name: newItem.name.trim(),
                description: newItem.description.trim(),
                purchasePrice: parseFloat(newItem.purchasePrice),
                sellingPrice: parseFloat(newItem.sellingPrice),
                status: 'available',
                photo_storage_url: photoUrl,
                containerId: newItem.containerId || null,
                categoryId: newItem.categoryId,
                qrCode
            };

            // Ajouter l'item et récupérer son ID
            const itemId = await database.addItem(itemToAdd);

            // Construire l'objet complet pour Redux
            const completeItem: Item = {
                id: itemId,
                ...itemToAdd,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            return completeItem;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['items'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            dispatch(addItem(data));
            triggerRefresh();
            resetForm();
            if (onSuccess) onSuccess();
        },
        onError: (error) => {
            handleError(error, 'Erreur lors de l\'ajout de l\'article', {
                source: 'item_form',
                message: 'Impossible d\'ajouter l\'article',
                showAlert: true
            });
        }
    });

    const handleSave = useCallback(async () => {
        const errors = validateForm();
        if (errors.length > 0) {
            Alert.alert(
                'Erreurs de validation',
                errors.map(error => error.message).join('\n')
            );
            return;
        }

        try {
            await addItemMutation.mutateAsync(item);
        } catch (error) {
            handleError(error, 'Erreur lors de la sauvegarde', {
                source: 'item_form',
                message: 'Impossible de sauvegarder l\'article',
                showAlert: true
            });
        }
    }, [item, validateForm, addItemMutation]);

    const handlePhotoUpload = async (uri: string) => {
        try {
            if (!await validatePhoto(uri)) {
                Alert.alert('Erreur', 'Photo invalide');
                return;
            }
            const photoUrl = await uploadPhoto(uri);
            setItem(prev => ({ ...prev, photo_storage_url: photoUrl }));
        } catch (error) {
            handleError(error, 'Erreur lors du téléchargement de la photo', {
                source: 'item_form',
                message: 'Impossible de télécharger la photo',
                showAlert: true
            });
        }
    };

    const handleSubmit = async () => {
        try {
            if (!validateForm()) return;

            let finalFormData = { ...item };
            if (item.photo_storage_url) {
                const photoUrl = await uploadPhoto(item.photo_storage_url);
                finalFormData.photo_storage_url = photoUrl;
            }

            await handleSave();
        } catch (error) {
            handleError(error, 'Erreur lors de la création', {
                source: 'item_form',
                message: 'Impossible de créer l\'article',
                showAlert: true
            });
        }
    };

    const handleContainerSelect = useCallback((containerId: number | undefined) => {
        if (containerId) {
            setItem(prev => ({ ...prev, containerId }));
        }
    }, []);

    const handleCategorySelect = useCallback((categoryId: number | undefined) => {
        if (categoryId) {
            setItem(prev => ({ ...prev, categoryId }));
        }
    }, []);

    return (
        <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nouvel Article</Text>
                <TouchableOpacity style={styles.saveButton} onPress={handleSubmit}>
                    <Text style={styles.saveText}>Enregistrer</Text>
                </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Informations générales</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Nom de l'article"
                        value={item.name}
                        onChangeText={(text) => setItem(prev => ({ ...prev, name: text }))}
                        placeholderTextColor="#999"
                    />

                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Description de l'article"
                        value={item.description}
                        onChangeText={(text) => setItem(prev => ({ ...prev, description: text }))}
                        multiline
                        numberOfLines={4}
                        placeholderTextColor="#999"
                    />
                </View>

                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Prix</Text>
                    <View style={styles.priceContainer}>
                        <View style={styles.priceWrapper}>
                            <Text style={styles.priceLabel}>Prix d'achat</Text>
                            <TextInput
                                style={[styles.input, styles.priceInput]}
                                placeholder="0.00"
                                value={item.purchasePrice}
                                keyboardType="numeric"
                                onChangeText={(text) => setItem(prev => ({ ...prev, purchasePrice: text }))}
                                placeholderTextColor="#999"
                            />
                        </View>
                        <View style={styles.priceWrapper}>
                            <Text style={styles.priceLabel}>Prix de vente</Text>
                            <TextInput
                                style={[styles.input, styles.priceInput]}
                                placeholder="0.00"
                                value={item.sellingPrice}
                                keyboardType="numeric"
                                onChangeText={(text) => setItem(prev => ({ ...prev, sellingPrice: text }))}
                                placeholderTextColor="#999"
                            />
                        </View>
                    </View>
                </View>

                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Photo</Text>
                    <View style={styles.imageContainer}>
                        {item.photo_storage_url ? (
                            <View style={styles.imageWrapper}>
                                <AdaptiveImage
                                    uri={item.photo_storage_url}
                                    style={styles.image}
                                    resizeMode="cover"
                                    placeholder={
                                        <View style={styles.placeholderContainer}>
                                            <MaterialIcons name="image" size={24} color="#ccc" />
                                        </View>
                                    }
                                />
                                <TouchableOpacity 
                                    style={styles.deletePhotoButton}
                                    onPress={() => setItem(prev => ({ ...prev, photo_storage_url: undefined }))}
                                >
                                    <MaterialIcons name="delete" size={24} color="#FF3B30" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <ImagePicker
                                onImageSelected={handlePhotoUpload}
                                onError={(error) => {
                                    Sentry.captureException(new Error(error), {
                                        tags: { context: 'item_form_image_picker' }
                                    });
                                    Alert.alert('Erreur', error);
                                }}
                            />
                        )}
                    </View>
                </View>

                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Emplacement</Text>
                    <ContainerList
                        containers={containers}
                        selectedId={item.containerId}
                        onSelect={handleContainerSelect}
                    />
                </View>

                <View style={[styles.formSection, styles.formSectionLast]}>
                    <Text style={styles.sectionTitle}>Catégorie</Text>
                    <CategoryList
                        categories={categories}
                        selectedId={item.categoryId}
                        onSelect={handleCategorySelect}
                    />
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e5e5',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#000',
    },
    saveButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    saveText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    formSection: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    formSectionLast: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#000',
        marginBottom: 12,
    },
    input: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#000',
        borderWidth: 1,
        borderColor: '#e5e5e5',
        marginBottom: 12,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    priceContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    priceWrapper: {
        flex: 1,
    },
    priceLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    priceInput: {
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
    },
    deletePhotoButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 20,
        padding: 8,
        zIndex: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
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
    containerIcon: {
        marginRight: 8,
    },
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
    },
    errorText: {
        fontSize: 16,
        color: '#FF3B30',
        textAlign: 'center',
        marginBottom: 16,
    },
    errorDetail: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 16,
    },
    retryButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default ItemFormWithErrorBoundary;