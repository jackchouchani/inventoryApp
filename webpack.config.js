const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function(env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);
  
  // Add PWA support
  config.plugins.push(
    new WebpackPwaManifest({
      name: 'Inventory App',
      short_name: 'Inventory',
      description: 'An inventory management application',
      background_color: '#ffffff',
      theme_color: '#000000',
      display: 'standalone',
      scope: '/',
      start_url: '/',
      icons: [
        {
          src: path.resolve('assets/icon.png'),
          sizes: [96, 128, 192, 256, 384, 512]
        }
      ]
    })
  );

  return config;
};