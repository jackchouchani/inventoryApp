#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { syncVersions } = require('./sync-version');

// Chemins des fichiers
const APP_JSON_PATH = path.join(__dirname, '../app.json');

function incrementVersion(version) {
  const parts = version.split('.');
  const patch = parseInt(parts[2]) + 1;
  return `${parts[0]}.${parts[1]}.${patch}`;
}

function testUpdate() {
  try {
    console.log('🧪 Test de mise à jour PWA');
    
    // Lire la version actuelle
    const appJson = JSON.parse(fs.readFileSync(APP_JSON_PATH, 'utf8'));
    const currentVersion = appJson.expo.version;
    const newVersion = incrementVersion(currentVersion);
    
    console.log(`📈 Incrémentation de version: ${currentVersion} → ${newVersion}`);
    
    // Mettre à jour app.json
    appJson.expo.version = newVersion;
    fs.writeFileSync(APP_JSON_PATH, JSON.stringify(appJson, null, 2));
    console.log(`✅ app.json mis à jour avec la version ${newVersion}`);
    
    // Synchroniser les autres fichiers
    syncVersions();
    
    console.log('🎉 Test de mise à jour terminé !');
    console.log('');
    console.log('📋 Prochaines étapes pour tester :');
    console.log('1. Déployez l\'application avec: npm run build:web');
    console.log('2. Ouvrez l\'application dans le navigateur');
    console.log('3. Vérifiez la console pour les logs du service worker');
    console.log('4. Une notification de mise à jour devrait apparaître');
    
  } catch (error) {
    console.error('❌ Erreur lors du test de mise à jour:', error.message);
    process.exit(1);
  }
}

// Exécuter le script si appelé directement
if (require.main === module) {
  testUpdate();
}

module.exports = { testUpdate, incrementVersion }; 