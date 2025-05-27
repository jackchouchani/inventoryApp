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
};