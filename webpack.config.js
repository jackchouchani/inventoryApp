const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const WorkboxWebpackPlugin = require('workbox-webpack-plugin');
const WebpackPwaManifest = require('webpack-pwa-manifest');
const path = require('path');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

module.exports = async function(env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);
  
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "crypto": require.resolve("crypto-browserify"),
    "stream": require.resolve("stream-browserify"),
    "buffer": require.resolve("buffer/"),
    "vm": require.resolve("vm-browserify")
  };

  config.plugins.push(new NodePolyfillPlugin());

  if (env.mode === 'production') {
    config.plugins.push(
      new WorkboxWebpackPlugin.GenerateSW({
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      }),
      new WebpackPwaManifest({
        name: 'Inventory App',
        short_name: 'Inventory',
        description: 'Application de gestion d\'inventaire',
        background_color: '#ffffff',
        theme_color: '#007AFF',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: path.resolve('assets/icon.png'),
            sizes: [96, 128, 192, 256, 384, 512],
            destination: path.join('icons'),
            purpose: 'any maskable'
          }
        ]
      })
    );
  }

  return config;
};