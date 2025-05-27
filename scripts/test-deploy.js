#!/usr/bin/env node

const { incrementVersion } = require('./test-update');
const { syncVersions } = require('./sync-version');
const fs = require('fs');
const path = require('path');

const APP_JSON_PATH = path.join(__dirname, '../app.json');

function testDeploy(platform = 'cloudflare', versionType = 'patch') {
  try {
    console.log(`🧪 Test de déploiement ${platform.toUpperCase()} (mode simulation)`);
    console.log('');
    
    // Sauvegarder la version actuelle
    const appJson = JSON.parse(fs.readFileSync(APP_JSON_PATH, 'utf8'));
    const originalVersion = appJson.expo.version;
    
    console.log(`📋 Version actuelle: ${originalVersion}`);
    
    // Calculer la nouvelle version selon le type
    let newVersion;
    const parts = originalVersion.split('.');
    
    switch (versionType) {
      case 'major':
        newVersion = `${parseInt(parts[0]) + 1}.0.0`;
        break;
      case 'minor':
        newVersion = `${parts[0]}.${parseInt(parts[1]) + 1}.0`;
        break;
      case 'patch':
      default:
        newVersion = incrementVersion(originalVersion);
        break;
    }
    
    console.log(`📈 Nouvelle version (${versionType}): ${originalVersion} → ${newVersion}`);
    console.log('');
    
    // Simuler les étapes selon la plateforme
    if (platform === 'expo') {
      console.log('🔄 Simulation déploiement Expo/EAS :');
      console.log('  1. ✅ Incrémentation de version dans app.json');
      console.log('  2. ✅ Synchronisation vers manifest.json et service-worker.js');
      console.log('  3. 📦 npx expo export --platform web (simulé)');
      console.log('  4. 🚀 eas deploy --prod (simulé)');
    } else if (platform === 'cloudflare') {
      console.log('🔄 Simulation déploiement Cloudflare :');
      console.log('  1. ✅ Incrémentation de version dans app.json');
      console.log('  2. ✅ Synchronisation vers manifest.json et service-worker.js');
      console.log('  3. 📝 git add . (simulé)');
      console.log('  4. 💾 git commit -m "🔄 Mise à jour PWA v' + newVersion + '" (simulé)');
      console.log('  5. 🚀 git push (simulé)');
      console.log('  6. 🏗️  Build automatique Cloudflare (simulé)');
    }
    
    console.log('');
    console.log('✅ Test de déploiement terminé avec succès !');
    console.log('');
    console.log('📋 Pour un déploiement réel, utilisez :');
    
    if (platform === 'expo') {
      console.log(`  npm run deploy:expo${versionType !== 'patch' ? ':' + versionType : ''}`);
    } else if (platform === 'cloudflare') {
      console.log(`  npm run deploy:cloudflare${versionType !== 'patch' ? ':' + versionType : ''}`);
    }
    
    console.log('');
    console.log('🔍 Vérifications recommandées avant déploiement :');
    console.log('  - Testez l\'application en local avec: npm run web');
    console.log('  - Vérifiez que tous les tests passent');
    console.log('  - Assurez-vous que les nouvelles fonctionnalités sont documentées');
    
    if (platform === 'cloudflare') {
      console.log('  - Vérifiez le statut Git avec: git status');
      console.log('  - Assurez-vous d\'être sur la bonne branche');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test de déploiement:', error.message);
    process.exit(1);
  }
}

// Gestion des arguments de ligne de commande
const args = process.argv.slice(2);
const platform = args[0] || 'cloudflare';
const versionType = args[1] || 'patch';

if (!['expo', 'cloudflare'].includes(platform)) {
  console.error('❌ Plateforme invalide. Utilisez: expo ou cloudflare');
  console.log('');
  console.log('📖 Utilisation :');
  console.log('  node scripts/test-deploy.js [expo|cloudflare] [patch|minor|major]');
  console.log('');
  console.log('📝 Exemples :');
  console.log('  node scripts/test-deploy.js cloudflare patch');
  console.log('  node scripts/test-deploy.js expo minor');
  process.exit(1);
}

if (!['major', 'minor', 'patch'].includes(versionType)) {
  console.error('❌ Type de version invalide. Utilisez: major, minor, ou patch');
  process.exit(1);
}

// Exécuter le script si appelé directement
if (require.main === module) {
  testDeploy(platform, versionType);
}

module.exports = { testDeploy }; 