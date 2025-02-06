import { supabase } from '../config/supabase';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

export const photoService = {
  async uploadPhoto(uri: string): Promise<string> {
    try {
      const filename = `photo_${Date.now()}.jpg`;
      
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        
        const { data, error } = await supabase.storage
          .from('photos')
          .upload(filename, blob);
          
        if (error) throw error;
        
        const { data: { publicUrl } } = supabase.storage
          .from('photos')
          .getPublicUrl(filename);
          
        return publicUrl;
      } else {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64
        });
        
        const { data, error } = await supabase.storage
          .from('photos')
          .upload(filename, Buffer.from(base64, 'base64'), {
            contentType: 'image/jpeg'
          });
          
        if (error) throw error;
        
        const { data: { publicUrl } } = supabase.storage
          .from('photos')
          .getPublicUrl(filename);
          
        return publicUrl;
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw error;
    }
  }
};
