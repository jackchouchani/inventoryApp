#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Préparation du build pour Cloudflare Pages...');

const distPath = path.join(__dirname, '..', 'dist');

// Fonction pour corriger les chemins dans le fichier index.html
function fixIndexHtml() {
  const indexPath = path.join(distPath, 'index.html');
  
  if (!fs.existsSync(indexPath)) {
    console.log('⚠️  index.html non trouvé');
    return;
  }
  
  let content = fs.readFileSync(indexPath, 'utf8');
  
  // Remplacer tous les chemins absolus par un chemin relatif vers notre fichier custom
  const patterns = [
    {
      regex: /src="\/Users\/[^"]*\/node_modules\/expo-router\/entry\.js"/g,
      replacement: 'src="/app-entry.js"',
      name: 'Users path'
    },
    {
      regex: /src="\/opt\/buildhome\/repo\/[^"]*\/node_modules\/expo-router\/entry\.js"/g,
      replacement: 'src="/app-entry.js"',
      name: 'Cloudflare buildhome path'
    },
    {
      regex: /src="\/opt\/buildhome\/repo\/node_modules\/expo-router\/entry\.js"/g,
      replacement: 'src="/app-entry.js"',
      name: 'Cloudflare direct path'
    }
  ];
  
  let modified = false;
  patterns.forEach(pattern => {
    if (content.match(pattern.regex)) {
      content = content.replace(pattern.regex, pattern.replacement);
      modified = true;
      console.log(`✅ Chemin entry.js corrigé (${pattern.name}) dans index.html`);
    }
  });
  
  if (modified) {
    fs.writeFileSync(indexPath, content);
  } else {
    console.log('ℹ️  Aucun chemin entry.js à corriger');
  }
}

// Créer le fichier app-entry.js personnalisé
function createCustomEntry() {
  const entryPath = path.join(distPath, 'app-entry.js');
  
  // Trouver le vrai fichier entry.js
  const possiblePaths = [
    path.join(distPath, 'Users/jackch/inventoryApp/node_modules/expo-router/entry.js'),
    path.join(distPath, 'opt/buildhome/repo/node_modules/expo-router/entry.js')
  ];
  
  let realEntryPath = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      realEntryPath = p;
      break;
    }
  }
  
  if (realEntryPath) {
    // Copier le contenu du vrai entry.js
    const entryContent = fs.readFileSync(realEntryPath, 'utf8');
    fs.writeFileSync(entryPath, entryContent);
    console.log('✅ Fichier app-entry.js créé avec succès');
  } else {
    // Créer un fichier d'entrée minimal
    const fallbackContent = `
// Fallback entry point for Expo Router
console.log('Loading Expo Router...');
import('/_expo/static/js/entry.js').catch(() => {
  console.error('Failed to load entry.js');
});
`;
    fs.writeFileSync(entryPath, fallbackContent);
    console.log('⚠️  Fichier app-entry.js créé avec fallback');
  }
}

if (fs.existsSync(distPath)) {
  fixIndexHtml();
  createCustomEntry();
  console.log('✅ Build Expo terminé, fichiers prêts pour Cloudflare !');
} else {
  console.log('⚠️  Le dossier dist n\'existe pas encore');
} 