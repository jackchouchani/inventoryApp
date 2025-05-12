export const MAX_PHOTO_SIZE = 1024 * 1024; // 1MB
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/avif', 'image/webp'];

export const PHOTO_COMPRESSION_OPTIONS = {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.85,
    compressionLevels: [
        { maxWidth: 1200, maxHeight: 1200, quality: 0.85 }, // Niveau 1: Qualité élevée, légère réduction de taille
        { maxWidth: 1000, maxHeight: 1000, quality: 0.75 }, // Niveau 2: Bonne qualité, réduction modérée
        { maxWidth: 800, maxHeight: 800, quality: 0.65 },   // Niveau 3: Qualité acceptable, réduction importante
        { maxWidth: 600, maxHeight: 600, quality: 0.5 }     // Niveau 4: Qualité minimale acceptable
    ]
} as const; 