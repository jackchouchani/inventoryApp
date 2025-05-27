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
  
  // Corriger le chemin vers entry.js
  const originalScript = /src="\/Users\/[^"]*\/node_modules\/expo-router\/entry\.js"/g;
  const newScript = 'src="/Users/jackch/inventoryApp/node_modules/expo-router/entry.js"';
  
  if (content.match(originalScript)) {
    content = content.replace(originalScript, newScript);
    fs.writeFileSync(indexPath, content);
    console.log('✅ Chemin entry.js corrigé dans index.html');
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