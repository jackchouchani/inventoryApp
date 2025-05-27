#!/usr/bin/env node

const { execSync } = require('child_process');
const { incrementVersion } = require('./test-update');
const { syncVersions } = require('./sync-version');
const fs = require('fs');
const path = require('path');

const APP_JSON_PATH = path.join(__dirname, '../app.json');

function deployCloudflare(versionType = 'patch', commitMessage = '') {
  try {
    console.log('🚀 Déploiement Cloudflare via GitHub avec mise à jour automatique');
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
    
    // Vérifier le statut Git
    console.log('📋 Vérification du statut Git...');
    try {
      const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
      if (!gitStatus.trim()) {
        console.log('⚠️  Aucun changement détecté dans Git');
        console.log('💡 Assurez-vous d\'avoir des modifications à commiter');
      }
    } catch (error) {
      console.log('⚠️  Impossible de vérifier le statut Git');
    }
    
    // Ajouter tous les fichiers modifiés
    console.log('📝 Ajout des fichiers modifiés...');
    execSync('git add .', { stdio: 'inherit' });
    
    // Créer le message de commit
    const finalCommitMessage = commitMessage || `🔄 Mise à jour PWA v${newVersion}`;
    
    // Commit
    console.log('💾 Commit des changements...');
    execSync(`git commit -m "${finalCommitMessage}"`, { stdio: 'inherit' });
    
    // Push vers GitHub
    console.log('🚀 Push vers GitHub...');
    execSync('git push', { stdio: 'inherit' });
    
    console.log('');
    console.log('🎉 Déploiement Cloudflare initié !');
    console.log(`📦 Version déployée: ${newVersion}`);
    console.log('');
    console.log('📋 Résultat :');
    console.log('✅ Version synchronisée dans tous les fichiers');
    console.log('✅ Changements commitées et pushées sur GitHub');
    console.log('✅ Cloudflare va automatiquement déployer la nouvelle version');
    console.log('✅ Les utilisateurs recevront automatiquement une notification de mise à jour');
    console.log('');
    console.log('🔍 Prochaines étapes :');
    console.log('1. Vérifiez le build sur Cloudflare Pages');
    console.log('2. Testez la nouvelle version sur votre site');
    console.log('3. Vérifiez les logs du service worker dans la console');
    
  } catch (error) {
    console.error('❌ Erreur lors du déploiement Cloudflare:', error.message);
    
    // Conseils de dépannage
    console.log('');
    console.log('🔧 Conseils de dépannage :');
    console.log('- Vérifiez que vous êtes sur la bonne branche Git');
    console.log('- Assurez-vous d\'avoir les droits de push sur le repository');
    console.log('- Vérifiez votre connexion internet');
    console.log('- Utilisez "git status" pour voir l\'état de votre repository');
    
    process.exit(1);
  }
}

// Gestion des arguments de ligne de commande
const args = process.argv.slice(2);
const versionType = args[0] || 'patch';
const commitMessage = args[1] || '';

if (!['major', 'minor', 'patch'].includes(versionType)) {
  console.error('❌ Type de version invalide. Utilisez: major, minor, ou patch');
  console.log('');
  console.log('📖 Utilisation :');
  console.log('  node scripts/deploy-cloudflare.js [patch|minor|major] ["message de commit optionnel"]');
  console.log('');
  console.log('📝 Exemples :');
  console.log('  node scripts/deploy-cloudflare.js patch');
  console.log('  node scripts/deploy-cloudflare.js minor "Nouvelle fonctionnalité scanner"');
  console.log('  node scripts/deploy-cloudflare.js major "Refonte complète de l\'interface"');
  process.exit(1);
}

// Exécuter le script si appelé directement
if (require.main === module) {
  deployCloudflare(versionType, commitMessage);
}

module.exports = { deployCloudflare }; 