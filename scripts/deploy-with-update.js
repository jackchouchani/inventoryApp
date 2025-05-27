#!/usr/bin/env node

const { execSync } = require('child_process');
const { incrementVersion } = require('./test-update');
const { syncVersions } = require('./sync-version');
const fs = require('fs');
const path = require('path');

const APP_JSON_PATH = path.join(__dirname, '../app.json');

function deployWithUpdate(versionType = 'patch') {
  try {
    console.log('🚀 Déploiement avec mise à jour automatique');
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
    
    // Build de l'application
    console.log('🏗️  Construction de l\'application...');
    execSync('npm run build:cloudflare', { stdio: 'inherit' });
    
    console.log('');
    console.log('🎉 Déploiement terminé !');
    console.log(`📦 Version déployée: ${newVersion}`);
    console.log('');
    console.log('📋 Prochaines étapes :');
    console.log('1. Uploadez le contenu du dossier dist/ vers votre serveur');
    console.log('2. Les utilisateurs recevront automatiquement une notification de mise à jour');
    console.log('3. Vérifiez les logs du service worker dans la console du navigateur');
    
  } catch (error) {
    console.error('❌ Erreur lors du déploiement:', error.message);
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
  deployWithUpdate(versionType);
}

module.exports = { deployWithUpdate }; 