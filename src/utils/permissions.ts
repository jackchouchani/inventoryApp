import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

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