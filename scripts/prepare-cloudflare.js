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
  
  // Corriger tous les chemins absolus vers entry.js
  const patterns = [
    {
      regex: /src="\/Users\/[^"]*\/node_modules\/expo-router\/entry\.js"/g,
      replacement: 'src="/Users/jackch/inventoryApp/node_modules/expo-router/entry.js"',
      name: 'Users path'
    },
    {
      regex: /src="\/opt\/buildhome\/repo\/[^"]*\/node_modules\/expo-router\/entry\.js"/g,
      replacement: 'src="/opt/buildhome/repo/node_modules/expo-router/entry.js"',
      name: 'Cloudflare buildhome path'
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

if (fs.existsSync(distPath)) {
  fixIndexHtml();
  console.log('✅ Build Expo terminé, fichiers prêts pour Cloudflare !');
} else {
  console.log('⚠️  Le dossier dist n\'existe pas encore');
} 