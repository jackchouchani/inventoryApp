import { supabase } from '../config/supabase';
import { handleError } from '../utils/errorHandler';
import { v4 as uuidv4 } from 'uuid';

class PhotoService {
  private readonly BUCKET_NAME = 'photos';
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  async uploadPhoto(uri: string): Promise<string> {
    try {
      const fileInfo = await this.validatePhoto(uri);
      if (!fileInfo.isValid || !fileInfo.blob) {
        throw new Error('Photo invalide');
      }

      const fileName = `${uuidv4()}.${fileInfo.extension}`;
      const filePath = `${this.BUCKET_NAME}/${fileName}`;

      const { error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(filePath, fileInfo.blob, {
          contentType: fileInfo.type,
          cacheControl: '3600'
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      handleError(error, 'Erreur lors du téléchargement de la photo', {
        source: 'photo_service_upload'
      });
      throw error;
    }
  }

  async deletePhoto(url: string): Promise<void> {
    try {
      const filePath = this.extractFilePathFromUrl(url);
      const { error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([filePath]);

      if (error) throw error;
    } catch (error) {
      handleError(error, 'Erreur lors de la suppression de la photo', {
        source: 'photo_service_delete'
      });
      throw error;
    }
  }

  async validatePhoto(uri: string): Promise<{
    isValid: boolean;
    blob?: Blob;
    type?: string;
    extension?: string;
  }> {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const type = blob.type;
      const extension = type.split('/')[1];

      if (!this.ALLOWED_TYPES.includes(type)) {
        return { isValid: false };
      }

      if (blob.size > this.MAX_FILE_SIZE) {
        return { isValid: false };
      }

      return {
        isValid: true,
        blob,
        type,
        extension
      };
    } catch (error) {
      handleError(error, 'Erreur lors de la validation de la photo', {
        source: 'photo_service_validate'
      });
      return { isValid: false };
    }
  }

  private extractFilePathFromUrl(url: string): string {
    const urlParts = url.split('/');
    return urlParts[urlParts.length - 1];
  }
}

export const photoService = new PhotoService(); 