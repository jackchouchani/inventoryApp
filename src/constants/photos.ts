export const MAX_PHOTO_SIZE = 1 * 1024 * 1024; // 1MB
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/avif'];

export const PHOTO_COMPRESSION_OPTIONS = {
    maxWidth: 1024,
    maxHeight: 1024,
    quality: 0.8
} as const; 