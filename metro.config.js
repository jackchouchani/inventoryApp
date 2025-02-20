// metro.config.js
const { getDefaultConfig } = require("@expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname, {
  isCSSEnabled: true, // Mode strict pour une meilleure compatibilité
});

// Ajout des alias pour les imports
config.resolver.alias = {
  "~": path.resolve(__dirname),
  "@": path.resolve(__dirname, "src"),
  "@components": path.resolve(__dirname, "src/components"),
  "@hooks": path.resolve(__dirname, "src/hooks"),
  "@utils": path.resolve(__dirname, "src/utils"),
  "@services": path.resolve(__dirname, "src/services"),
  "@types": path.resolve(__dirname, "src/types"),
  "@theme": path.resolve(__dirname, "src/theme"),
  "@config": path.resolve(__dirname, "src/config"),
};

// Extensions supportées
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  "ts",
  "tsx",
  "js",
  "jsx",
  "json",
  "mjs",
  "cjs",
];
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  "db",
  "ttf",
  "otf",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "mp3",
];

// Résolution des points d’entrée
config.resolver.resolverMainFields = ["react-native", "browser", "main"];

module.exports = config;