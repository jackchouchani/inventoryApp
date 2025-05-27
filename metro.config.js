const { getDefaultConfig } = require('@expo/metro-config');

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
};