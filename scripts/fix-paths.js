#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Correction des chemins absolus pour Cloudflare Pages...');

// Fonction pour corriger les chemins dans un fichier HTML
function fixPathsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Corriger les chemins absolus vers node_modules/expo-router/entry.js
  const absolutePathRegex = /src="\/[^"]*node_modules\/expo-router\/entry\.js"/g;
  if (content.match(absolutePathRegex)) {
    content = content.replace(absolutePathRegex, 'src="/_expo/static/js/entry.js"');
    modified = true;
    console.log(`✅ Corrigé le chemin entry.js dans ${filePath}`);
  }

  // Corriger les chemins absolus vers /opt/buildhome/repo/
  const buildhomeRegex = /src="\/opt\/buildhome\/repo\/[^"]*"/g;
  if (content.match(buildhomeRegex)) {
    content = content.replace(buildhomeRegex, 'src="/_expo/static/js/entry.js"');
    modified = true;
    console.log(`✅ Corrigé le chemin buildhome dans ${filePath}`);
  }

  // Corriger d'autres chemins absolus problématiques
  const otherAbsolutePathRegex = /src="\/[^"]*\/([^\/]+\.js)"/g;
  content = content.replace(otherAbsolutePathRegex, (match, filename) => {
    if (!match.includes('/_expo/')) {
      modified = true;
      return `src="/_expo/static/js/${filename}"`;
    }
    return match;
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`📝 Fichier modifié : ${filePath}`);
  }
}

// Trouver tous les fichiers HTML dans le dossier dist
const distPath = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distPath)) {
  console.error('❌ Le dossier dist n\'existe pas. Exécutez d\'abord expo export.');
  process.exit(1);
}

// Utiliser une approche simple sans glob si le module n'est pas disponible
function findHtmlFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...findHtmlFiles(fullPath));
    } else if (item.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

try {
  const htmlFiles = findHtmlFiles(distPath);
  
  if (htmlFiles.length === 0) {
    console.log('⚠️  Aucun fichier HTML trouvé dans dist/');
    process.exit(0);
  }

  console.log(`📁 ${htmlFiles.length} fichiers HTML trouvés`);
  
  htmlFiles.forEach(fixPathsInFile);
  
  console.log('✅ Correction des chemins terminée !');
} catch (error) {
  console.error('❌ Erreur lors de la correction des chemins :', error.message);
  process.exit(1);
} 