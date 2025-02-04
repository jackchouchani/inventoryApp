module.exports = {
  name: 'Inventory App',
  slug: 'inventory-cv',
  platforms: ['ios', 'android', 'web'],
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'inventoryapp',
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/favicon.png'
  },
  plugins: ['expo-router'],
  extra: {
    eas: {
      projectId: "493303ca-8459-4234-b01d-1103a21f67c1"
    }
  },
  owner: "jackch"
}; 