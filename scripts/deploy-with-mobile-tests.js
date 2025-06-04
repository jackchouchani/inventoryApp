#!/usr/bin/env node

/**
 * Script de déploiement unifié avec tests d'images mobiles
 * Supporte: deploy:both (expo + cloudflare), deploy:web (cloudflare seul)
 * Types de version: patch (défaut), minor, major
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const versionType = process.argv[2] || 'patch';
const deployMode = process.argv[3] || 'both'; // both, web, expo

// Validation des arguments
const validVersionTypes = ['patch', 'minor', 'major'];
const validDeployModes = ['both', 'web', 'expo'];

if (!validVersionTypes.includes(versionType)) {
    console.error(`❌ Type de version invalide: ${versionType}`);
    console.error(`✅ Types valides: ${validVersionTypes.join(', ')}`);
    process.exit(1);
}

if (!validDeployModes.includes(deployMode)) {
    console.error(`❌ Mode de déploiement invalide: ${deployMode}`);
    console.error(`✅ Modes valides: ${validDeployModes.join(', ')}`);
    process.exit(1);
}

console.log(`🚀 Déploiement ${deployMode} (${versionType}) avec tests d'images mobiles...\n`);

// Fonction pour attendre la fin d'un processus
function waitForProcess(childProcess) {
    return new Promise((resolve, reject) => {
        let output = '';
        
        childProcess.stdout?.on('data', (data) => {
            const text = data.toString();
            output += text;
            process.stdout.write(`[EXPO] ${text}`);
        });
        
        childProcess.stderr?.on('data', (data) => {
            const text = data.toString();
            output += text;
            process.stderr.write(`[EXPO] ${text}`);
        });
        
        childProcess.on('close', (code) => {
            if (code === 0) {
                console.log('\n✅ Déploiement Expo terminé avec succès');
                resolve(output);
            } else {
                console.error(`\n❌ Échec du déploiement Expo (code: ${code})`);
                reject(new Error(`Expo deployment failed with code ${code}`));
            }
        });
        
        childProcess.on('error', (error) => {
            console.error(`\n❌ Erreur lors du lancement du déploiement Expo:`, error);
            reject(error);
        });
    });
}

// Fonction principale async
async function main() {
    try {
        // 1. Synchronisation des versions
        console.log('\n🔄 Synchronisation des versions...');
        execSync('npm run sync-version', { stdio: 'inherit' });
        
        // 2. Tests d'images mobiles (optionnel, uniquement pour expo)
        if (deployMode === 'expo' || deployMode === 'both') {
            console.log('\n📱 Tests d\'images mobiles...');
            try {
                execSync('npm run test-mobile-images', { stdio: 'inherit' });
                console.log('✅ Tests d\'images mobiles réussis');
            } catch (error) {
                console.warn('⚠️  Tests d\'images mobiles échoués, poursuite du déploiement...');
            }
        }
        
        // 3. Déploiement selon le mode
        switch (deployMode) {
            case 'both':
                // Déploiement simultané Expo + Cloudflare
                console.log(`\n🌐 Déploiement simultané Expo + Cloudflare (${versionType})...`);
                
                // Déploiement Expo en parallèle (arrière-plan)
                console.log('\n📱 Lancement du déploiement Expo...');
                const expoProcess = spawn('npm', ['run', `deploy:expo${versionType === 'patch' ? '' : ':' + versionType}`], {
                    stdio: ['inherit', 'pipe', 'pipe'],
                    shell: true
                });
                
                // Déploiement Cloudflare immédiat
                console.log('\n☁️  Déploiement Cloudflare...');
                execSync(`npm run deploy:cloudflare${versionType === 'patch' ? '' : ':' + versionType}`, { stdio: 'inherit' });
                
                // Attendre que le déploiement Expo se termine
                console.log('\n⏳ Attente de la fin du déploiement Expo...');
                await waitForProcess(expoProcess);
                break;
                
            case 'web':
                // Déploiement Cloudflare uniquement
                console.log(`\n☁️  Déploiement Web/Cloudflare (${versionType})...`);
                execSync(`npm run deploy:cloudflare${versionType === 'patch' ? '' : ':' + versionType}`, { stdio: 'inherit' });
                break;
                
            case 'expo':
                // Déploiement Expo uniquement
                console.log(`\n📱 Déploiement Expo/EAS (${versionType})...`);
                execSync(`npm run deploy:expo${versionType === 'patch' ? '' : ':' + versionType}`, { stdio: 'inherit' });
                break;
        }
        
        // 4. Messages de succès selon le mode
        console.log('\n✅ Déploiement terminé avec succès!');
        
        if (deployMode === 'both') {
            console.log('\n🎉 Applications déployées sur:');
            console.log('📱 Expo/EAS - Disponible pour les appareils mobiles');
            console.log('🌐 Cloudflare Pages - Disponible sur le web');
        } else if (deployMode === 'web') {
            console.log('\n🌐 Application web déployée sur Cloudflare Pages');
        } else if (deployMode === 'expo') {
            console.log('\n📱 Application mobile déployée sur Expo/EAS');
        }
        
        console.log('\n📋 Tests post-déploiement recommandés:');
        
        if (deployMode === 'expo' || deployMode === 'both') {
            console.log('📱 MOBILE (Expo):');
            console.log('  1. Testez la sélection d\'images sur mobile');
            console.log('  2. Vérifiez l\'aperçu des images');
            console.log('  3. Testez l\'upload et la sauvegarde');
            console.log('  4. Vérifiez le scanner natif');
        }
        
        if (deployMode === 'web' || deployMode === 'both') {
            console.log('🌐 WEB (Cloudflare):');
            console.log('  1. Testez le scanner PWA');
            console.log('  2. Vérifiez les fonctionnalités offline');
            console.log('  3. Testez sur différents navigateurs');
            console.log('  4. Vérifiez la gestion des images web');
        }
        
        console.log('\n🔗 Liens utiles:');
        if (deployMode === 'expo' || deployMode === 'both') {
            console.log('📱 Expo: https://inventory-cv.expo.app');
        }
        if (deployMode === 'web' || deployMode === 'both') {
            console.log('🌐 Cloudflare: https://inventory.comptoirvintage.com');
        }
        
    } catch (error) {
        console.error('\n❌ Erreur lors du déploiement:', error.message);
        
        // Messages d'aide selon l'erreur
        if (error.message.includes('expo')) {
            console.error('\n🔧 Solutions possibles pour Expo:');
            console.error('  1. Vérifiez votre authentification: npx expo login');
            console.error('  2. Vérifiez la configuration: cat app.json');
            console.error('  3. Vérifiez les permissions EAS: npx eas whoami');
        }
        
        if (error.message.includes('cloudflare')) {
            console.error('\n🔧 Solutions possibles pour Cloudflare:');
            console.error('  1. Vérifiez wrangler auth: npx wrangler whoami');
            console.error('  2. Vérifiez la configuration: cat wrangler.toml');
            console.error('  3. Vérifiez les variables d\'environnement');
        }
        
        process.exit(1);
    }
}

// Lancer la fonction principale
main(); 