import * as Permissions from 'expo-permissions';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

export const checkPermission = async (permission: Permissions.PermissionType): Promise<boolean> => {
  try {
    const { status } = await Permissions.getAsync(permission);
    if (status === 'granted') return true;

    const { status: newStatus } = await Permissions.askAsync(permission);
    return newStatus === 'granted';
  } catch (error) {
    console.error(`Erreur lors de la vérification des permissions ${permission}:`, error);
    return false;
  }
};

export const checkCameraPermission = async (): Promise<boolean> => {
  const { status } = await Camera.requestCameraPermissionsAsync();
  return status === 'granted';
};

export const checkMediaLibraryPermission = async (): Promise<boolean> => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}; 