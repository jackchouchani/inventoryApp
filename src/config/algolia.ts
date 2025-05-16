import algoliasearch from 'algoliasearch/lite';

// Définition des constantes pour l'API Algolia
export const ALGOLIA_APP_ID = 'XA2OW9WJL0';
export const ALGOLIA_SEARCH_API_KEY = '7c9ddbf79d9c19d60d7ce4d18c353f3a';
export const INDEX_NAME = 'data'; // Ou le nom de votre index principal si différent

// Vérification de la présence des clés API
if (!ALGOLIA_APP_ID || !ALGOLIA_SEARCH_API_KEY) {
  console.error('Algolia App ID or Search API Key is not defined.');
  throw new Error('Algolia configuration error.');
}

// Initialisation du client Algolia
export const searchClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_SEARCH_API_KEY);

// Attributs que nous voulons récupérer pour l'affichage et le filtrage
export const attributesToRetrieve = [
  'objectID', // Toujours nécessaire
  'name',
  'description',
  'category_name', // Dénormalisé
  'photo_storage_url',
  'selling_price',
  'purchase_price',
  'status',
  'qr_code',
  'category_id',
  'container_id',
  'created_at', // Timestamp UNIX
  'updated_at', // Timestamp UNIX
  // Pour les containers, si ce sont des champs spécifiques et non présents dans les items :
  'number', 
  'doc_type', // Essentiel pour distinguer items et containers
];

// Configuration pour le faceting (filtrage)
// Ces attributs doivent être déclarés comme \"attributesForFaceting\" dans votre configuration d'index Algolia
export const attributesForFaceting = [
  'filterOnly(doc_type)', // filterOnly si pas besoin de compter les facettes
  'status',
  'category_id',
  'container_id',
  // 'selling_price', // Pour le filtrage par prix (numeric) - pas besoin de le mettre ici si numeric
  // 'created_at' // Pour le filtrage par date (numeric) - pas besoin de le mettre ici si numeric
];

// Configuration suggérée pour les attributs (peut être ajustée dans votre dashboard Algolia)
export const algoliaConfig = {
  attributesToRetrieve: [
    'objectID', // Toujours nécessaire
    'name',
    'description',
    'category_name', // Pour affichage direct si nécessaire
    'photo_storage_url',
    'selling_price',
    'purchase_price',
    'status',
    'qr_code',
    'category_id',
    'container_id',
    'created_at',
    'updated_at',
    // 'user_id' a été retiré car pas directement utilisé par le front-end pour l'instant pour la recherche/affichage.
    // 'quantity' n'est pas inclus car il n'était pas dans le type Item. À ajouter si nécessaire.
  ],
  attributesToHighlight: ['name', 'description'],
  // Nombre maximum de résultats à retourner par requête
  hitsPerPage: 1000,
  // D'autres configurations comme `snippetEllipsisText` peuvent être ajoutées ici
  // ou gérées directement dans les widgets InstantSearch.
}; 