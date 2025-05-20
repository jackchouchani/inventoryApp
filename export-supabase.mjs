import { createClient } from '@supabase/supabase-js';
import fs from 'fs'; // Pour sauvegarder la liste dans un fichier

// À remplacer par vos informations Supabase
const SUPABASE_URL = 'https://lixpixyyszvcuwpcgmxe.supabase.co'; // Votre URL de projet Supabase
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpeHBpeHl5c3p2Y3V3cGNnbXhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODg0NTU3MCwiZXhwIjoyMDU0NDIxNTcwfQ.wCBmBPZYGfYeLnvwcZ_jjbil9epibXg7lAX2-g-7-Ck'; // Ou votre clé anon si elle a les droits
const BUCKET_NAME = 'images'; // Le nom de votre bucket

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function listAllFilesRecursively(bucketName, path = '') {
  let filesFromCurrentCall = [];
  let offset = 0;
  const limit = 1000; // Vous pouvez augmenter jusqu'à 2000 selon les versions/plans

  console.log(`Listage du chemin: '<span class="math-inline">\{path \|\| "<racine\>"\}' dans le bucket '</span>{bucketName}'`);

  while (true) {
    const { data, error } = await supabase
      .storage
      .from(bucketName)
      .list(path, {
        limit: limit,
        offset: offset,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (error) {
      console.error(`Erreur lors du listage des fichiers dans <span class="math-inline">\{bucketName\} au chemin "</span>{path}":`, error.message);
      throw error; 
    }

    if (!data || data.length === 0) {
      break; // Plus de fichiers/dossiers dans ce chemin à cet offset
    }

    filesFromCurrentCall.push(...data);

    if (data.length < limit) {
      break; // C'était la dernière page pour ce chemin
    }
    offset += limit; // Passer à la page suivante
  }

  const allFilePaths = [];
  for (const item of filesFromCurrentCall) {
    const currentItemPath = path ? `<span class="math-inline">\{path\}/</span>{item.name}` : item.name;
    if (item.id === null || item.name.endsWith('/')) { // Indique un dossier (id:null ou parfois nom finissant par /)
      console.log(`Dossier trouvé: ${currentItemPath}, exploration...`);
      allFilePaths.push(...await listAllFilesRecursively(bucketName, currentItemPath));
    } else { // C'est un fichier
      allFilePaths.push(currentItemPath);
    }
  }
  return allFilePaths;
}

async function main() {
  console.log(`Début du listage des fichiers du bucket: ${BUCKET_NAME}`);
  try {
    const files = await listAllFilesRecursively(BUCKET_NAME);
    console.log(`\n${files.length} fichiers trouvés au total.`);

    // Sauvegarder la liste dans un fichier, une clé par ligne
    const filePath = 'liste_fichiers_supabase.txt';
    fs.writeFileSync(filePath, files.join('\n'));
    console.log(`La liste des fichiers a été sauvegardée dans : ${filePath}`);
    console.log("\nExtrait des premières clés de fichiers :");
    files.slice(0, 10).forEach(file => console.log(file));

  } catch (e) {
    console.error('Erreur dans la fonction principale:', e);
  }
}

main();