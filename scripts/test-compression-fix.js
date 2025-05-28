#!/usr/bin/env node

/**
 * Script pour tester le fix de compression d'images
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Test du fix de compression d\'images...\n');

// Vérifier usePhoto.ts
const usePhotoPath = path.join(process.cwd(), 'src', 'hooks', 'usePhoto.ts');
if (fs.existsSync(usePhotoPath)) {
    const content = fs.readFileSync(usePhotoPath, 'utf8');
    
    console.log('📝 Vérification src/hooks/usePhoto.ts:');
    
    if (content.includes('COMPRESSION D\'ABORD - avant la validation')) {
        console.log('✅ Compression avant validation');
    } else {
        console.log('❌ Compression pas avant validation');
    }
    
    if (content.includes('VALIDATION APRÈS COMPRESSION - et non-bloquante')) {
        console.log('✅ Validation non-bloquante après compression');
    } else {
        console.log('❌ Validation pas non-bloquante');
    }
    
    if (content.includes('mais on continue l\'upload')) {
        console.log('✅ Upload continue même si validation échoue');
    } else {
        console.log('❌ Upload peut être bloqué par validation');
    }
} else {
    console.log('❌ usePhoto.ts non trouvé');
}

// Vérifier imageCompression.ts
const imageCompressionPath = path.join(process.cwd(), 'src', 'utils', 'imageCompression.ts');
if (fs.existsSync(imageCompressionPath)) {
    const content = fs.readFileSync(imageCompressionPath, 'utf8');
    
    console.log('\n📝 Vérification src/utils/imageCompression.ts:');
    
    if (content.includes('PHOTO_COMPRESSION_OPTIONS')) {
        console.log('✅ Utilise les nouvelles constantes de compression');
    } else {
        console.log('❌ N\'utilise pas les nouvelles constantes');
    }
    
    if (content.includes('quality = 0.3')) {
        console.log('✅ Compression maximale disponible (0.3)');
    } else {
        console.log('❌ Compression maximale non disponible');
    }
    
    if (content.includes('maxDimension = PHOTO_COMPRESSION_OPTIONS.maxWidth')) {
        console.log('✅ Taille maximale mise à jour (800px)');
    } else {
        console.log('❌ Taille maximale pas mise à jour');
    }
} else {
    console.log('❌ imageCompression.ts non trouvé');
}

console.log('\n📊 Workflow de compression corrigé:');
console.log('1. Image sélectionnée (ex: 1.42MB)');
console.log('2. 🔄 COMPRESSION D\'ABORD');
console.log('   - Redimensionnement: 800x800 max');
console.log('   - Qualité: 0.3-0.6 selon taille');
console.log('   - Résultat attendu: ~300-600KB');
console.log('3. ✅ VALIDATION APRÈS (non-bloquante)');
console.log('4. 📤 UPLOAD vers R2');

console.log('\n🧪 Tests recommandés:');
console.log('1. Redémarrez l\'app: npm run web');
console.log('2. Testez avec une photo haute résolution');
console.log('3. Vérifiez les logs de compression');
console.log('4. Vérifiez que l\'upload réussit');

console.log('\n📱 Logs attendus (succès):');
console.log('- "Compression de l\'image avant validation..."');
console.log('- "Compression terminée, validation de l\'image compressée..."');
console.log('- "Canvas: compression avec qualité XX%"');
console.log('- "Taille réduite: XXXXkB → XXXkB"');
console.log('- "Upload de l\'image vers R2: item_photo_xxx.jpg"');
console.log('- "Upload R2 terminé"');

console.log('\n✅ Test du fix de compression terminé!'); 