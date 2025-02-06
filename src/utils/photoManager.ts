import { supabase } from '../config/supabase';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

const BUCKET_NAME = 'photos';

export const savePhoto = async (uri: string): Promise<string> => {
  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );

    const filename = `photo_${Date.now()}.jpg`;
    const photoUri = manipResult.uri;

    const response = await fetch(photoUri);
    const blob = await response.blob();

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, blob);

    if (error) throw error;

    const { data: publicUrl } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename);

    return publicUrl.publicUrl;
  } catch (error) {
    console.error('Error saving photo:', error);
    throw new Error(`Failed to save photo: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const deletePhoto = async (uri: string): Promise<void> => {
  try {
    const filename = uri.split('/').pop();
    if (!filename) throw new Error('Invalid photo URI');

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filename]);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting photo:', error);
    throw new Error(`Failed to delete photo: ${error instanceof Error ? error.message : String(error)}`);
  }
};