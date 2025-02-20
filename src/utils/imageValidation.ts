const VALID_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const VALID_URI_PROTOCOLS = ['https:', 'file:', 'data:', 'blob:'];

export const isValidImageUri = (uri: string): boolean => {
  try {
    // Vérifier le protocole
    if (uri.startsWith('data:')) {
      return uri.startsWith('data:image/');
    }

    if (uri.startsWith('blob:')) {
      return true; // Les blobs sont considérés comme valides pour le web
    }

    const url = new URL(uri);
    if (!VALID_URI_PROTOCOLS.includes(url.protocol)) {
      return false;
    }

    // Vérifier l'extension pour les URLs HTTP(S)
    if (url.protocol.startsWith('http')) {
      const hasValidExtension = VALID_IMAGE_EXTENSIONS.some(ext => 
        url.pathname.toLowerCase().endsWith(ext)
      );
      return hasValidExtension;
    }

    // Pour les fichiers locaux
    if (url.protocol === 'file:') {
      return VALID_IMAGE_EXTENSIONS.some(ext => 
        uri.toLowerCase().endsWith(ext)
      );
    }

    return true;
  } catch (e) {
    return false;
  }
}; 