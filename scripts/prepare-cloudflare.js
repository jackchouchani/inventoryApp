#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Préparation du build pour Cloudflare Pages...');

const distPath = path.join(__dirname, '..', 'dist');
const expoStaticPath = path.join(distPath, '_expo', 'static', 'js');

// Créer le dossier _expo/static/js s'il n'existe pas
if (!fs.existsSync(expoStaticPath)) {
  fs.mkdirSync(expoStaticPath, { recursive: true });
  console.log('📁 Créé le dossier _expo/static/js');
}

// Copier le fichier entry.js depuis node_modules
const entrySourcePath = path.join(__dirname, '..', 'node_modules', 'expo-router', 'entry.js');
const entryDestPath = path.join(expoStaticPath, 'entry.js');

if (fs.existsSync(entrySourcePath)) {
  fs.copyFileSync(entrySourcePath, entryDestPath);
  console.log('📋 Copié entry.js vers _expo/static/js/');
} else {
  console.log('⚠️  entry.js non trouvé dans node_modules');
}

// Fonction pour corriger les chemins dans les fichiers HTML
function fixPathsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Corriger tous les chemins absolus problématiques
  const patterns = [
    {
      regex: /src="\/[^"]*node_modules\/expo-router\/entry\.js"/g,
      replacement: 'src="/_expo/static/js/entry.js"',
      name: 'node_modules entry.js'
    },
    {
      regex: /src="\/opt\/buildhome\/repo\/[^"]*entry\.js"/g,
      replacement: 'src="/_expo/static/js/entry.js"',
      name: 'buildhome entry.js'
    },
    {
      regex: /src="\/Users\/[^"]*\/entry\.js"/g,
      replacement: 'src="/_expo/static/js/entry.js"',
      name: 'Users entry.js'
    }
  ];

  patterns.forEach(pattern => {
    if (content.match(pattern.regex)) {
      content = content.replace(pattern.regex, pattern.replacement);
      modified = true;
      console.log(`✅ Corrigé ${pattern.name} dans ${path.basename(filePath)}`);
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
  }
}

// Trouver et corriger tous les fichiers HTML
function findAndFixHtmlFiles(dir) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      findAndFixHtmlFiles(fullPath);
    } else if (item.endsWith('.html')) {
      fixPathsInFile(fullPath);
    }
  }
}

if (fs.existsSync(distPath)) {
  findAndFixHtmlFiles(distPath);
  console.log('✅ Correction des chemins terminée !');
} else {
  console.log('⚠️  Le dossier dist n\'existe pas encore');
} 