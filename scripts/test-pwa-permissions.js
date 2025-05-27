#!/usr/bin/env node

/**
 * Script pour tester les permissions PWA
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Test des permissions PWA...\n');

// Vérifier le manifest.json
const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');

if (!fs.existsSync(manifestPath)) {
    console.error('❌ Fichier manifest.json non trouvé dans public/');
    process.exit(1);
}

try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    console.log('📋 Vérification du manifest.json:');
    
    // Vérifier les permissions
    if (manifest.permissions && manifest.permissions.includes('camera')) {
        console.log('✅ Permission caméra déclarée');
    } else {
        console.log('❌ Permission caméra manquante');
    }
    
    if (manifest.permissions && manifest.permissions.includes('microphone')) {
        console.log('✅ Permission microphone déclarée');
    } else {
        console.log('❌ Permission microphone manquante');
    }
    
    // Vérifier les features
    if (manifest.features && manifest.features.includes('Camera')) {
        console.log('✅ Feature Camera déclarée');
    } else {
        console.log('❌ Feature Camera manquante');
    }
    
    // Vérifier le display mode
    if (manifest.display === 'standalone') {
        console.log('✅ Mode standalone configuré');
    } else {
        console.log('⚠️  Mode display:', manifest.display);
    }
    
    // Vérifier le scope
    if (manifest.scope === '/') {
        console.log('✅ Scope configuré correctement');
    } else {
        console.log('⚠️  Scope:', manifest.scope);
    }
    
    console.log('\n📱 Configuration PWA:');
    console.log(`   Nom: ${manifest.name || manifest.short_name}`);
    console.log(`   Version: ${manifest.version}`);
    console.log(`   Start URL: ${manifest.start_url}`);
    console.log(`   Icônes: ${manifest.icons ? manifest.icons.length : 0} configurées`);
    
} catch (error) {
    console.error('❌ Erreur lors de la lecture du manifest.json:', error.message);
    process.exit(1);
}

// Vérifier le fichier pwaPermissions.ts
const pwaPermissionsPath = path.join(process.cwd(), 'src', 'utils', 'pwaPermissions.ts');

if (fs.existsSync(pwaPermissionsPath)) {
    console.log('\n🔧 Utilitaires PWA:');
    console.log('✅ Fichier pwaPermissions.ts trouvé');
    
    const content = fs.readFileSync(pwaPermissionsPath, 'utf8');
    
    if (content.includes('checkCameraPermissionPWA')) {
        console.log('✅ Fonction checkCameraPermissionPWA disponible');
    }
    
    if (content.includes('requestCameraPermissionPWA')) {
        console.log('✅ Fonction requestCameraPermissionPWA disponible');
    }
    
    if (content.includes('isPWAMode')) {
        console.log('✅ Fonction isPWAMode disponible');
    }
} else {
    console.log('\n❌ Fichier pwaPermissions.ts non trouvé');
}

// Vérifier le service worker
const swPath = path.join(process.cwd(), 'public', 'service-worker.js');

if (fs.existsSync(swPath)) {
    console.log('\n🔄 Service Worker:');
    console.log('✅ Service worker trouvé');
    
    const swContent = fs.readFileSync(swPath, 'utf8');
    
    if (swContent.includes('APP_VERSION')) {
        console.log('✅ Versioning configuré');
    }
    
    if (swContent.includes('cache')) {
        console.log('✅ Cache configuré');
    }
} else {
    console.log('\n⚠️  Service worker non trouvé');
}

console.log('\n🚀 Recommandations pour tester:');
console.log('1. Déployez l\'application');
console.log('2. Installez la PWA sur votre appareil');
console.log('3. Testez le scanner dans la PWA installée');
console.log('4. Vérifiez les permissions dans les paramètres du navigateur');

console.log('\n📖 Instructions de débogage:');
console.log('- Ouvrez les DevTools (F12)');
console.log('- Allez dans l\'onglet Console');
console.log('- Recherchez les logs "Permission caméra PWA"');
console.log('- Vérifiez l\'onglet Application > Manifest');

console.log('\n✅ Test des permissions PWA terminé!'); 