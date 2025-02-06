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
        EXPO_OS: 'web'
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