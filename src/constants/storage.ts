// Nom du bucket de stockage pour les photos
export const PHOTOS = 'images';

// URL de base du serveur Supabase Storage
export const S3_URL = 'https://lixpixyyszvcuwpcgmxe.supabase.co/storage/v1';

// Taille maximale des photos en octets (5 Mo)
export const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

// Types MIME autorisés pour les photos
export const ALLOWED_PHOTO_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif'
];

// Options de compression des photos
export const PHOTO_COMPRESSION_OPTIONS = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 0.8
}; 