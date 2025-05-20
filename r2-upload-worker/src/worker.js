export default {
  async fetch(request, env) {
    // Handle CORS preflight requests (OPTIONS method)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*', // Autoriser toutes les origines pour le développement
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-filename, x-api-key',
          'Access-Control-Max-Age': '86400', // Cache la réponse preflight pendant 24h
        },
      });
    }

    // Vérification de l'authentification
    const authHeader = request.headers.get('x-api-key');
    if (!authHeader || authHeader !== env.SECRET_KEY) {
        // Ajouter l'en-tête CORS même pour les réponses d'erreur non autorisées
        const unauthorizedResponse = new Response('Non autorisé', { status: 401 });
        unauthorizedResponse.headers.set('Access-Control-Allow-Origin', '*');
        return unauthorizedResponse;
    }

    // Si l'authentification réussit, le reste du code s'exécute
    const url = new URL(request.url);
    let response; // Variable pour stocker la réponse

    if (request.method === "GET") {
      // Vous pourriez vouloir ajouter des en-têtes CORS ici aussi si ce endpoint est utilisé par l'app
      response = new Response('Hello World');
    } else if (request.method === "POST") {
      const filename = request.headers.get("x-filename") || `photo_${Date.now()}.jpg`;
      const body = await request.arrayBuffer();

      await env.MY_BUCKET.put(filename, body, {
        httpMetadata: { contentType: "image/jpeg" }, // Considérez à déduire le type MIME du body si possible
      });

      response = new Response(JSON.stringify({ filename }), {
        headers: { "Content-Type": "application/json" },
      });
    } else if (request.method === "DELETE") {
      const filename = url.searchParams.get("filename");
      if (!filename) {
        // Ajouter l'en-tête CORS même pour les réponses d'erreur
        const badRequestResponse = new Response("Paramètre filename manquant", { status: 400 });
        badRequestResponse.headers.set('Access-Control-Allow-Origin', '*');
        return badRequestResponse;
      }

      await env.MY_BUCKET.delete(filename);

      response = new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } else {
        // Ajouter l'en-tête CORS même pour les méthodes non autorisées
        const methodNotAllowedResponse = new Response("Méthode non autorisée", { status: 405 });
        methodNotAllowedResponse.headers.set('Access-Control-Allow-Origin', '*');
        return methodNotAllowedResponse;
    }

    // Ajouter les en-têtes CORS à la réponse finale pour POST/DELETE/GET
    response.headers.set('Access-Control-Allow-Origin', '*'); // Autoriser toutes les origines pour le développement
    return response;
  },
};