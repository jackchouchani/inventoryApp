#!/usr/bin/env node

/**
 * Script pour tester les corrections d'images sur mobile web
 */

const fs = require('fs');
const path = require('path');

console.log('🖼️  Test des corrections d\'images mobile web...\n');

// Vérifier ItemEditForm.tsx
const itemEditFormPath = path.join(process.cwd(), 'src', 'components', 'ItemEditForm.tsx');
if (fs.existsSync(itemEditFormPath)) {
    const content = fs.readFileSync(itemEditFormPath, 'utf8');
    
    console.log('📝 Vérification ItemEditForm.tsx:');
    
    if (content.includes('Platform.OS === \'web\'') && content.includes('selectedAsset.base64')) {
        console.log('✅ Logique web base64 ajoutée');
    } else {
        console.log('❌ Logique web base64 manquante');
    }
    
    if (content.includes('data:${mimeType};base64,${selectedAsset.base64}')) {
        console.log('✅ Conversion base64 URI correcte');
    } else {
        console.log('❌ Conversion base64 URI manquante');
    }
    
    if (content.includes('selectedUri = base64Uri')) {
        console.log('✅ Attribution URI base64 correcte');
    } else {
        console.log('❌ Attribution URI base64 manquante');
    }
} else {
    console.log('❌ ItemEditForm.tsx non trouvé');
}

// Vérifier ItemForm.tsx
const itemFormPath = path.join(process.cwd(), 'src', 'components', 'ItemForm.tsx');
if (fs.existsSync(itemFormPath)) {
    const content = fs.readFileSync(itemFormPath, 'utf8');
    
    console.log('\n📝 Vérification ItemForm.tsx:');
    
    if (content.includes('let photoStorageUrl = undefined')) {
        console.log('✅ Initialisation photoStorageUrl corrigée');
    } else {
        console.log('❌ Initialisation photoStorageUrl incorrecte');
    }
    
    if (content.includes('localImage && localImage.needsUpload')) {
        console.log('✅ Condition upload localImage correcte');
    } else {
        console.log('❌ Condition upload localImage manquante');
    }
    
    if (content.includes('Platform.OS === \'web\'') && content.includes('selectedAsset.base64')) {
        console.log('✅ Logique web base64 présente');
    } else {
        console.log('❌ Logique web base64 manquante');
    }
} else {
    console.log('❌ ItemForm.tsx non trouvé');
}

// Vérifier AdaptiveImage.tsx
const adaptiveImagePath = path.join(process.cwd(), 'src', 'components', 'AdaptiveImage.tsx');
if (fs.existsSync(adaptiveImagePath)) {
    const content = fs.readFileSync(adaptiveImagePath, 'utf8');
    
    console.log('\n📝 Vérification AdaptiveImage.tsx:');
    
    if (content.includes('data:image/')) {
        console.log('✅ Support base64 URI présent');
    } else {
        console.log('❌ Support base64 URI manquant');
    }
    
    if (content.includes('isLocalImage')) {
        console.log('✅ Détection image locale présente');
    } else {
        console.log('❌ Détection image locale manquante');
    }
} else {
    console.log('❌ AdaptiveImage.tsx non trouvé');
}

console.log('\n🧪 Tests recommandés:');
console.log('1. Testez sur navigateur mobile (Chrome/Safari mobile)');
console.log('2. Sélectionnez une image dans ItemForm');
console.log('3. Vérifiez l\'aperçu de l\'image');
console.log('4. Sauvegardez et vérifiez que l\'image est uploadée');
console.log('5. Testez l\'édition d\'un article avec image');

console.log('\n📱 Navigateurs à tester:');
console.log('- Chrome mobile (Android)');
console.log('- Safari mobile (iOS)');
console.log('- Firefox mobile');
console.log('- Samsung Internet');

console.log('\n🔍 Points de débogage:');
console.log('- Ouvrez les DevTools mobile');
console.log('- Vérifiez les logs console pour "Image convertie en base64"');
console.log('- Vérifiez les logs d\'upload R2');
console.log('- Testez avec différentes tailles d\'images');

console.log('\n✅ Test des corrections terminé!'); 