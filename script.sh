#!/bin/bash
PUBLIC_URL_BASE="https://lixpixyyszvcuwpcgmxe.supabase.co/storage/v1/object/public/images"
DOWNLOAD_DIR="supabase_downloads_$(date +%Y%m%d_%H%M%S)" # Crée un dossier unique
mkdir -p "$DOWNLOAD_DIR"
INPUT_FILE="liste_fichiers_supabase.txt" # Fichier généré à l'étape 1

if [ ! -f "$INPUT_FILE" ]; then
    echo "Erreur: Le fichier '$INPUT_FILE' n'a pas été trouvé."
    exit 1
fi

while IFS= read -r object_key_from_list; do
  if [ -z "$object_key_from_list" ]; then
    continue
  fi

  # Construire la partie de l'URL en s'assurant du préfixe "//"
  # et en gérant les / initiaux possibles dans object_key_from_list
  # pour éviter des ///
  url_object_path="$object_key_from_list"
  if [[ "$url_object_path" == //* ]]; then
    # Déjà correct si la clé commence par //
    : 
  elif [[ "$url_object_path" == /* ]]; then
    # Commence par un seul /, on ajoute un autre / devant
    url_object_path="/${url_object_path}"
  else
    # Ne commence pas par /, on ajoute //
    url_object_path="//${url_object_path}"
  fi

  full_url="${PUBLIC_URL_BASE}${url_object_path}"
  
  # Chemin local pour sauvegarder
  # On utilise la clé telle quelle pour le chemin local pour préserver la structure
  local_save_path="${DOWNLOAD_DIR}/${object_key_from_list}"

  mkdir -p "$(dirname "$local_save_path")"

  echo "Téléchargement de ${full_url} vers ${local_save_path}..."
  wget --tries=3 --timeout=15 -O "$local_save_path" "$full_url"
  if [ $? -ne 0 ]; then
    echo "ERREUR lors du téléchargement de ${full_url}" >> erreurs_telechargement.txt
  fi
  sleep 0.05 # Petite pause
done < "$INPUT_FILE"

echo "Téléchargement terminé. Vérifiez 'erreurs_telechargement.txt' pour les échecs."