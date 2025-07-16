const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

module.exports = {
  ...config,
  resolver: {
    ...config.resolver,
    sourceExts: [...config.resolver.sourceExts, 'mjs', 'cjs'],
    resolverMainFields: ['react-native', 'browser', 'main'],
    platforms: ['ios', 'android', 'native', 'web'],
    blockList: [
      /node_modules\/jspdf\/dist\/jspdf\.node\.min\.js$/,
    ],
    alias: {
      // Seulement les polyfills essentiels pour éviter les conflits
      buffer: 'buffer',
      crypto: 'crypto-browserify',
      events: 'events',
      util: 'util',
    },
    // Résolveur personnalisé pour bloquer ws sur mobile
    resolverMainFields: ['react-native', 'browser', 'main'],
    resolveRequest: (context, moduleName, platform) => {
      // Bloquer ws sur mobile
      if (moduleName === 'ws' && platform !== 'web') {
        return {
          filePath: path.resolve(__dirname, 'src/polyfills/ws-mock.js'),
          type: 'sourceFile',
        };
      }
      
      // Bloquer aussi les sous-modules de ws
      if (moduleName.startsWith('ws/') && platform !== 'web') {
        return {
          filePath: path.resolve(__dirname, 'src/polyfills/ws-mock.js'),
          type: 'sourceFile',
        };
      }
      
      // Laisser le résolveur par défaut gérer le reste
      return context.resolveRequest(context, moduleName, platform);
    },
  },
  transformer: {
    ...config.transformer,
    assetExts: [...(config.transformer.assetExts || []), 'woff', 'woff2', 'ttf', 'otf'],
    unstable_allowRequireContext: true,
  },
  server: {
    enhanceMiddleware: (middleware) => {
      return (req, res, next) => {
        // Force correct MIME types for JavaScript files
        if (req.url && req.url.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript');
        } else if (req.url && req.url.endsWith('.mjs')) {
          res.setHeader('Content-Type', 'application/javascript');
        }
        return middleware(req, res, next);
      };
    },
  },
  // Désactiver le fast refresh pour éviter les reloads automatiques
  resetCache: false,
};