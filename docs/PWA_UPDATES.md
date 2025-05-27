# Système de Mise à Jour PWA

## Vue d'ensemble

Ce système permet de gérer automatiquement les mises à jour de votre Progressive Web App (PWA) en synchronisant les versions entre `app.json`, `manifest.json` et `service-worker.js`.

## Comment ça fonctionne

### 1. Synchronisation des versions

Quand vous modifiez la version dans `app.json`, le script `sync-version.js` met automatiquement à jour :
- `public/manifest.json` - Version PWA
- `public/service-worker.js` - Version du cache

### 2. Détection des mises à jour

Le service worker compare la version dans le manifest avec sa version interne :
- Si différente → Notification de mise à jour disponible
- L'utilisateur peut choisir de mettre à jour maintenant ou plus tard

### 3. Application des mises à jour

Quand l'utilisateur accepte :
- Le nouveau service worker s'active
- Le cache est vidé
- L'application se recharge avec la nouvelle version

## Utilisation

### Déployer une nouvelle version

1. **Modifier la version dans `app.json`** :
```json
{
  "expo": {
    "version": "1.3.0"
  }
}
```

2. **Construire l'application** :
```bash
npm run build:web
# ou
npm run build:cloudflare
```

Le script `sync-version` s'exécute automatiquement avant le build.

### Synchroniser manuellement

```bash
npm run sync-version
```

### Intégrer le composant de notification

Dans votre composant principal :

```tsx
import UpdateNotification from '../components/UpdateNotification';

export default function App() {
  return (
    <View>
      {/* Votre application */}
      <UpdateNotification 
        onUpdateAvailable={(version) => {
          console.log('Nouvelle version disponible:', version);
        }}
      />
    </View>
  );
}
```

## Configuration

### Service Worker

Le service worker utilise une stratégie **Network First** :
- Essaie d'abord le réseau
- Fallback sur le cache si hors ligne
- Met à jour le cache avec les nouvelles ressources

### Cache

Le nom du cache inclut la version : `inventory-app-cache-v1.3.0`
- Chaque version a son propre cache
- Les anciens caches sont automatiquement supprimés

## Debugging

### Console du navigateur

Le service worker log ses actions :
```
[SW] Installation du service worker version: 1.3.0
[SW] Nouvelle version détectée: 1.3.0
[SW] Suppression du cache obsolète: inventory-app-cache-v1.2.0
```

### Forcer une mise à jour

Dans la console du navigateur :
```javascript
// Vérifier manuellement les mises à jour
navigator.serviceWorker.controller.postMessage({ type: 'CHECK_UPDATE' });

// Forcer l'activation d'un nouveau service worker
navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
```

### Vider le cache

```javascript
// Supprimer tous les caches
caches.keys().then(names => {
  names.forEach(name => caches.delete(name));
});
```

## Bonnes pratiques

1. **Toujours incrémenter la version** dans `app.json` avant le déploiement
2. **Tester en local** avec `npm run web` avant le déploiement
3. **Vérifier les logs** du service worker dans la console
4. **Informer les utilisateurs** des nouvelles fonctionnalités dans les notifications

## Dépannage

### La mise à jour ne se déclenche pas

1. Vérifiez que la version a bien changé dans tous les fichiers
2. Videz le cache du navigateur (Ctrl+Shift+R)
3. Vérifiez la console pour les erreurs du service worker

### L'application ne se met pas à jour

1. Vérifiez que le service worker est bien enregistré
2. Regardez l'onglet "Application" dans les DevTools
3. Forcez l'activation du nouveau service worker

### Cache persistant

Si l'ancienne version persiste :
1. Désinstallez le service worker dans DevTools
2. Videz tous les caches
3. Rechargez la page

## Scripts disponibles

### Synchronisation et test
- `npm run sync-version` - Synchronise les versions manuellement
- `npm run test-update` - Teste le système de mise à jour (incrémente la version patch)

### Déploiement automatique Expo/EAS
- `npm run deploy:expo` - Déploiement Expo/EAS avec incrémentation patch (1.2.0 → 1.2.1)
- `npm run deploy:expo:minor` - Déploiement Expo/EAS avec incrémentation minor (1.2.0 → 1.3.0)
- `npm run deploy:expo:major` - Déploiement Expo/EAS avec incrémentation major (1.2.0 → 2.0.0)

### Déploiement automatique Cloudflare
- `npm run deploy:cloudflare` - Déploiement Cloudflare avec incrémentation patch (1.2.0 → 1.2.1)
- `npm run deploy:cloudflare:minor` - Déploiement Cloudflare avec incrémentation minor (1.2.0 → 1.3.0)
- `npm run deploy:cloudflare:major` - Déploiement Cloudflare avec incrémentation major (1.2.0 → 2.0.0)

### Build manuel
- `npm run build:web` - Build web avec sync automatique
- `npm run build:cloudflare` - Build Cloudflare avec sync automatique 