export default {
    expo: {
      name: 'inventoryapp',
      slug: 'inventoryapp',
      version: '1.0.0',
      scheme: 'inventoryapp',
      web: {
        bundler: 'metro'
      },
      extra: {
        SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      },
      plugins: [
        [
          'expo-router',
          {
            root: 'app'
          }
        ]
      ]
    }
  };