#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Chemins des fichiers
const APP_JSON_PATH = path.join(__dirname, '../app.json');
const MANIFEST_JSON_PATH = path.join(__dirname, '../public/manifest.json');
const SERVICE_WORKER_PATH = path.join(__dirname, '../public/service-worker.js');

function syncVersions() {
  try {
    // Lire la version depuis app.json
    const appJson = JSON.parse(fs.readFileSync(APP_JSON_PATH, 'utf8'));
    const version = appJson.expo.version;
    
    console.log(`🔄 Synchronisation de la version: ${version}`);

    // Mettre à jour manifest.json
    const manifestJson = JSON.parse(fs.readFileSync(MANIFEST_JSON_PATH, 'utf8'));
    manifestJson.version = version;
    fs.writeFileSync(MANIFEST_JSON_PATH, JSON.stringify(manifestJson, null, 2));
    console.log(`✅ manifest.json mis à jour avec la version ${version}`);

    // Mettre à jour service-worker.js
    let serviceWorkerContent = fs.readFileSync(SERVICE_WORKER_PATH, 'utf8');
    const versionRegex = /const APP_VERSION = '[^']+'/;
    const newVersionLine = `const APP_VERSION = '${version}'`;
    
    if (versionRegex.test(serviceWorkerContent)) {
      serviceWorkerContent = serviceWorkerContent.replace(versionRegex, newVersionLine);
    } else {
      // Si la ligne n'existe pas, l'ajouter au début
      serviceWorkerContent = `${newVersionLine}; // Synchronisé avec app.json\n${serviceWorkerContent}`;
    }
    
    fs.writeFileSync(SERVICE_WORKER_PATH, serviceWorkerContent);
    console.log(`✅ service-worker.js mis à jour avec la version ${version}`);

    console.log(`🎉 Synchronisation terminée pour la version ${version}`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation des versions:', error.message);
    process.exit(1);
  }
}

// Exécuter le script si appelé directement
if (require.main === module) {
  syncVersions();
}

module.exports = { syncVersions }; 