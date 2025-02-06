export default {
    expo: {
      name: 'inventoryapp',
      slug: 'inventoryapp',
      version: '1.0.0',
      scheme: 'inventoryapp',
      web: {
        bundler: 'metro',
        output: 'static',
        devClient: {
          overlay: {
            enabled: true,
            LogProvider: true
          }
        }
      },
      extra: {
        router: {
          disableTutorial: true,
          origin: false
        },
        EXPO_OS: 'web',
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