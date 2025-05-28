#!/usr/bin/env node

/**
 * Script pour tester les configurations de compression d'images
 */

const fs = require('fs');
const path = require('path');

console.log('🖼️  Test des configurations de compression d\'images...\n');

// Vérifier les constantes de photos
const photosConstantsPath = path.join(process.cwd(), 'src', 'constants', 'photos.ts');
if (fs.existsSync(photosConstantsPath)) {
    const content = fs.readFileSync(photosConstantsPath, 'utf8');
    
    console.log('📝 Vérification src/constants/photos.ts:');
    
    if (content.includes('maxWidth: 800') && content.includes('maxHeight: 800')) {
        console.log('✅ Taille par défaut réduite (800x800)');
    } else {
        console.log('❌ Taille par défaut non réduite');
    }
    
    if (content.includes('quality: 0.6')) {
        console.log('✅ Qualité par défaut réduite (0.6)');
    } else {
        console.log('❌ Qualité par défaut non réduite');
    }
    
    if (content.includes('quality: 0.3')) {
        console.log('✅ Compression maximale disponible (0.3)');
    } else {
        console.log('❌ Compression maximale non disponible');
    }
} else {
    console.log('❌ photos.ts non trouvé');
}

// Vérifier ItemEditForm.tsx
const itemEditFormPath = path.join(process.cwd(), 'src', 'components', 'ItemEditForm.tsx');
if (fs.existsSync(itemEditFormPath)) {
    const content = fs.readFileSync(itemEditFormPath, 'utf8');
    
    console.log('\n📝 Vérification ItemEditForm.tsx:');
    
    if (content.includes('quality: 0.3')) {
        console.log('✅ Compression forte activée (0.3)');
    } else {
        console.log('❌ Compression forte non activée');
    }
    
    if (content.includes('Validation ignorée')) {
        console.log('✅ Validation photo non-bloquante');
    } else {
        console.log('❌ Validation photo peut encore bloquer');
    }
} else {
    console.log('❌ ItemEditForm.tsx non trouvé');
}

// Vérifier ItemForm.tsx
const itemFormPath = path.join(process.cwd(), 'src', 'components', 'ItemForm.tsx');
if (fs.existsSync(itemFormPath)) {
    const content = fs.readFileSync(itemFormPath, 'utf8');
    
    console.log('\n📝 Vérification ItemForm.tsx:');
    
    if (content.includes('quality: 0.3')) {
        console.log('✅ Compression forte activée (0.3)');
    } else {
        console.log('❌ Compression forte non activée');
    }
} else {
    console.log('❌ ItemForm.tsx non trouvé');
}

console.log('\n📊 Estimation des tailles d\'images:');
console.log('- Photo iPhone 12MP → ~3-4MB original');
console.log('- Avec quality: 0.7 → ~1.5-2MB (trop gros)');
console.log('- Avec quality: 0.5 → ~1-1.5MB (limite)');
console.log('- Avec quality: 0.3 → ~500KB-800KB (optimal)');

console.log('\n🧪 Tests recommandés:');
console.log('1. Redémarrez l\'app: npm run web');
console.log('2. Testez avec une photo haute résolution');
console.log('3. Vérifiez que l\'aperçu s\'affiche');
console.log('4. Vérifiez que l\'upload réussit');
console.log('5. Vérifiez les logs de compression');

console.log('\n📱 Logs attendus (succès):');
console.log('- "Image convertie en base64 pour le web"');
console.log('- "Validation ignorée, passage direct à la mise à jour des états"');
console.log('- "États mis à jour avec succès"');
console.log('- "Upload R2 réussi"');

console.log('\n✅ Test de compression terminé!'); 