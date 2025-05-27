#!/usr/bin/env node

const { execSync } = require('child_process');
const { incrementVersion } = require('./test-update');
const { syncVersions } = require('./sync-version');
const fs = require('fs');
const path = require('path');

const APP_JSON_PATH = path.join(__dirname, '../app.json');

function deployExpo(versionType = 'patch') {
  try {
    console.log('🚀 Déploiement Expo/EAS avec mise à jour automatique');
    console.log('');
    
    // Lire la version actuelle
    const appJson = JSON.parse(fs.readFileSync(APP_JSON_PATH, 'utf8'));
    const currentVersion = appJson.expo.version;
    
    // Calculer la nouvelle version selon le type
    let newVersion;
    const parts = currentVersion.split('.');
    
    switch (versionType) {
      case 'major':
        newVersion = `${parseInt(parts[0]) + 1}.0.0`;
        break;
      case 'minor':
        newVersion = `${parts[0]}.${parseInt(parts[1]) + 1}.0`;
        break;
      case 'patch':
      default:
        newVersion = incrementVersion(currentVersion);
        break;
    }
    
    console.log(`📈 Mise à jour de version (${versionType}): ${currentVersion} → ${newVersion}`);
    
    // Mettre à jour app.json
    appJson.expo.version = newVersion;
    fs.writeFileSync(APP_JSON_PATH, JSON.stringify(appJson, null, 2));
    console.log(`✅ app.json mis à jour`);
    
    // Synchroniser les autres fichiers
    console.log('🔄 Synchronisation des versions...');
    syncVersions();
    
    // Export Expo pour le web
    console.log('📦 Export Expo pour le web...');
    execSync('npx expo export --platform web', { stdio: 'inherit' });
    
    // Déploiement EAS
    console.log('🚀 Déploiement EAS...');
    execSync('eas deploy --prod', { stdio: 'inherit' });
    
    console.log('');
    console.log('🎉 Déploiement Expo/EAS terminé !');
    console.log(`📦 Version déployée: ${newVersion}`);
    console.log('');
    console.log('📋 Résultat :');
    console.log('✅ Version synchronisée dans tous les fichiers');
    console.log('✅ Export Expo terminé');
    console.log('✅ Déploiement EAS terminé');
    console.log('✅ Les utilisateurs recevront automatiquement une notification de mise à jour');
    
  } catch (error) {
    console.error('❌ Erreur lors du déploiement Expo/EAS:', error.message);
    process.exit(1);
  }
}

// Gestion des arguments de ligne de commande
const args = process.argv.slice(2);
const versionType = args[0] || 'patch';

if (!['major', 'minor', 'patch'].includes(versionType)) {
  console.error('❌ Type de version invalide. Utilisez: major, minor, ou patch');
  process.exit(1);
}

// Exécuter le script si appelé directement
if (require.main === module) {
  deployExpo(versionType);
}

module.exports = { deployExpo }; 