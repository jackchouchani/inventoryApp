import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

// ==================================================================================
// PERMISSIONS PHOTO - VERSION SIMPLIFIÉE
// ==================================================================================
// Garde seulement checkPhotoPermissions nécessaire pour les formulaires d'items
// Le reste des permissions est géré par useCameraPermissions
// ==================================================================================

/**
 * Vérifie et demande les permissions pour accéder à la galerie photo
 * Utilisé uniquement pour la sélection d'images dans les formulaires
 */
export const checkPhotoPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(
                'Permission refusée',
                'Nous avons besoin d\'accéder à vos photos pour cette fonctionnalité.'
            );
            return false;
        }
    }
    return true;
}; 