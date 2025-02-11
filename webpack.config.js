const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const webpack = require('webpack');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);
  
  // Ajout de la gestion des fichiers audio
  config.module.rules.push({
    test: /\.(mp3|wav)$/,
    loader: 'file-loader',
    options: {
      name: '[path][name].[ext]',
    },
  });

  config.plugins.push(
    new webpack.DefinePlugin({
      'process.env.EXPO_ROUTER_APP_ROOT': JSON.stringify('app'),
      'process.env.EXPO_ROUTER_IMPORT_MODE': JSON.stringify('sync'),
      'process.env.FULL_SCREEN': JSON.stringify('true'),
    })
  );

  return config;
};