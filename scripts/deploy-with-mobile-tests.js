#!/usr/bin/env node

/**
 * Script de déploiement avec tests d'images mobiles
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const versionType = process.argv[2] || 'patch';
const deployTarget = process.argv[3] || 'cloudflare'; // cloudflare ou expo

console.log(`🚀 Déploiement ${deployTarget} avec tests d'images mobiles...\n`);

try {
    // 1. Tests des corrections d'images mobiles
    console.log('🖼️  Test des corrections d\'images mobiles...');
    execSync('npm run test-mobile-images', { stdio: 'inherit' });
    
    // 2. Tests PWA (si applicable)
    console.log('\n🔍 Test des permissions PWA...');
    execSync('npm run test-pwa', { stdio: 'inherit' });
    
    // 3. Synchronisation des versions
    console.log('\n🔄 Synchronisation des versions...');
    execSync('npm run sync-version', { stdio: 'inherit' });
    
    // 4. Déploiement selon la cible
    if (deployTarget === 'expo') {
        if (versionType === 'patch') {
            console.log(`\n📱 Déploiement Expo/EAS (${versionType})...`);
            execSync(`npm run deploy:expo`, { stdio: 'inherit' });
        } else {
            console.log(`\n📱 Déploiement Expo/EAS (${versionType})...`);
            execSync(`npm run deploy:expo:${versionType}`, { stdio: 'inherit' });
        }
    } else {
        if (versionType === 'patch') {
            console.log(`\n☁️  Déploiement Cloudflare (${versionType})...`);
            execSync(`npm run deploy:cloudflare`, { stdio: 'inherit' });
        } else {
            console.log(`\n☁️  Déploiement Cloudflare (${versionType})...`);
            execSync(`npm run deploy:cloudflare:${versionType}`, { stdio: 'inherit' });
        }
    }
    
    console.log('\n✅ Déploiement terminé avec succès!');
    console.log('\n📋 Tests post-déploiement recommandés:');
    console.log('1. Testez la sélection d\'images sur mobile');
    console.log('2. Vérifiez l\'aperçu des images');
    console.log('3. Testez l\'upload et la sauvegarde');
    console.log('4. Vérifiez le scanner PWA');
    console.log('5. Testez sur différents navigateurs mobiles');
    
} catch (error) {
    console.error('\n❌ Erreur lors du déploiement:', error.message);
    process.exit(1);
} 