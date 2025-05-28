export const MAX_PHOTO_SIZE = 1024 * 1024; // 1MB
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/avif', 'image/webp'];

export const PHOTO_COMPRESSION_OPTIONS = {
    maxWidth: 800,  // Réduction de la taille par défaut
    maxHeight: 800, // Réduction de la taille par défaut
    quality: 0.6,   // Compression plus forte par défaut
    compressionLevels: [
        { maxWidth: 800, maxHeight: 800, quality: 0.6 },   // Niveau 1: Compression modérée
        { maxWidth: 600, maxHeight: 600, quality: 0.5 },   // Niveau 2: Bonne compression
        { maxWidth: 500, maxHeight: 500, quality: 0.4 },   // Niveau 3: Compression forte
        { maxWidth: 400, maxHeight: 400, quality: 0.3 }    // Niveau 4: Compression maximale
    ]
} as const; 