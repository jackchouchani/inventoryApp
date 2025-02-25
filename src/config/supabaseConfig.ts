export const SUPABASE_CONFIG = {
  S3_URL: 'https://lixpixyyszvcuwpcgmxe.supabase.co/storage/v1/s3',
  STORAGE: {
    BUCKETS: {
      PHOTOS: 'images'
    },
    MAX_FILE_SIZE: 500 * 1024, // 500KB
    CACHE_CONTROL: '3600',
    CONTENT_TYPE: {
      JPEG: 'image/jpeg'
    }
  }
}; 