export default {
  async fetch(request, env) {
    // Gestion des requêtes CORS preflight (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-filename, x-api-key',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Vérification de l'authentification
    const authHeader = request.headers.get('x-api-key');
    if (!authHeader || authHeader !== env.SECRET_KEY) {
      const unauthorizedResponse = new Response('Non autorisé', { status: 401 });
      unauthorizedResponse.headers.set('Access-Control-Allow-Origin', '*');
      return unauthorizedResponse;
    }

    // Traitement des requêtes POST pour l'upload des factures
    if (request.method === 'POST') {
      try {
        const filename = request.headers.get('x-filename') || `facture_${Date.now()}.pdf`;
        const body = await request.arrayBuffer();
        
        // Vérifier que le fichier n'est pas vide
        if (!body || body.byteLength === 0) {
          const badRequestResponse = new Response('Le fichier est vide', { status: 400 });
          badRequestResponse.headers.set('Access-Control-Allow-Origin', '*');
          return badRequestResponse;
        }

        // Uploader le fichier dans le bucket R2
        await env.INVOICES_BUCKET.put(filename, body, {
          httpMetadata: { 
            contentType: 'application/pdf',
            contentDisposition: `inline; filename="${filename}"`
          },
        });

        const response = new Response(
          JSON.stringify({ 
            success: true, 
            filename,
            url: `https://invoices.comptoirvintage.com/${filename}`
          }), 
          { 
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            } 
          }
        );
        
        return response;
      } catch (error) {
        console.error('Erreur lors du traitement de la facture:', error);
        const errorResponse = new Response(
          JSON.stringify({ error: 'Erreur lors du traitement de la facture' }), 
          { 
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            } 
          }
        );
        return errorResponse;
      }
    }

    // Pour toutes les autres méthodes non supportées
    const methodNotAllowedResponse = new Response('Méthode non autorisée', { status: 405 });
    methodNotAllowedResponse.headers.set('Access-Control-Allow-Origin', '*');
    return methodNotAllowedResponse;
  },
};
