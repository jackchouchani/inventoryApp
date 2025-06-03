# Solution PWA - Gestion des Suspensions et Réactivations

## Problème Initial

L'application PWA se bloquait sur l'écran de chargement après une période d'inactivité prolongée. L'utilisateur devait fermer et rouvrir l'application pour qu'elle fonctionne à nouveau.

## Causes Identifiées

### 1. Suspension PWA
- Quand une PWA reste inactive (onglet en arrière-plan, appareil en veille), elle peut entrer en état de suspension
- Les processus JavaScript peuvent être gelés pour économiser les ressources
- La reconnexion réseau peut échouer silencieusement

### 2. Cache Browser (bfcache)
- Le navigateur peut restaurer l'application depuis un cache figé
- L'état Redux peut devenir obsolète
- Les connexions réseau peuvent être perdues

### 3. Timeouts d'Authentification
- La session Supabase peut expirer
- Les hooks peuvent rester bloqués en état de chargement

## Solution Implémentée

### 1. Détection de Cycle de Vie PWA (`usePWALifecycle`)

```typescript
// Hook dans app/_layout.tsx
function usePWALifecycle() {
  const [appWasHidden, setAppWasHidden] = useState(false);
  const [reactivationCount, setReactivationCount] = useState(0);
  
  // Détection visibilitychange, focus, pageshow
  // Rafraîchissement automatique après 30s d'inactivité
}
```

**Fonctionnalités :**
- ✅ Détecte quand l'app devient invisible/visible
- ✅ Mesure la durée d'inactivité
- ✅ Déclenche un rafraîchissement automatique des données après 30s
- ✅ Gère la restauration depuis bfcache

### 2. Service Worker Amélioré

```javascript
// public/service-worker.js
let lastActiveTime = Date.now();
let isAppSuspended = false;

// Détection d'inactivité prolongée (5 minutes)
setInterval(() => {
  const timeSinceLastActive = Date.now() - lastActiveTime;
  if (timeSinceLastActive > 300000 && !isAppSuspended) {
    isAppSuspended = true;
  }
}, 60000);
```

**Fonctionnalités :**
- ✅ Tracking de l'activité utilisateur
- ✅ Communication bidirectionnelle avec l'app
- ✅ Détection de suspension automatique
- ✅ Notification de réactivation

### 3. Hook Service Worker (`usePWAServiceWorker`)

```typescript
export const usePWAServiceWorker = () => {
  const [isServiceWorkerReady, setIsServiceWorkerReady] = useState(false);
  const [lastReactivation, setLastReactivation] = useState<Date | null>(null);
  
  // Heartbeat toutes les 30 secondes
  // Écoute des messages du service worker
  // Événements personnalisés (pwa-reactivated)
}
```

**Fonctionnalités :**
- ✅ Heartbeat régulier vers le service worker
- ✅ Écoute des notifications de réactivation
- ✅ Événements custom pour synchronisation
- ✅ Gestion automatique des listeners

### 4. DataLoader Renforcé

```typescript
// src/components/DataLoader.tsx
const [showTimeout, setShowTimeout] = useState(false);
const [retryCount, setRetryCount] = useState(0);

// Timeout de 15 secondes pour afficher l'option de retry
// Bouton "Réessayer" avec escalade vers rechargement de page
```

**Fonctionnalités :**
- ✅ Timeout de sécurité (15 secondes)
- ✅ Interface de retry utilisateur
- ✅ Escalade : Retry → Redux refresh → Page reload
- ✅ Compteur de tentatives

### 5. Timeout de Sécurité Global

```typescript
// app/_layout.tsx
const [forceReady, setForceReady] = useState(false);

// Timeout de 10 secondes pour forcer la sortie du loading
setTimeout(() => {
  setForceReady(true);
  window.location.reload(); // Dernier recours
}, 10000);
```

**Fonctionnalités :**
- ✅ Timeout global de 10 secondes
- ✅ Rechargement forcé en dernier recours
- ✅ Évite les blocages infinis

## Flux de Réactivation

### Scénario 1 : Inactivité Courte (< 30s)
1. User revient sur l'app
2. Pas d'action spéciale
3. App continue normalement

### Scénario 2 : Inactivité Moyenne (30s - 5min)
1. `visibilitychange` détecte le retour
2. Déclenche `usePWALifecycle`
3. Rafraîchissement automatique des données Redux
4. Affichage "Synchronisation en cours..."

### Scénario 3 : Inactivité Longue (> 5min)
1. Service Worker détecte la suspension
2. Envoie message `APP_REACTIVATED`
3. Événement `pwa-reactivated` déclenché
4. Rafraîchissement complet des données
5. Compteur de réactivation affiché

### Scénario 4 : Blocage Critique
1. Timeout DataLoader (15s)
2. Interface "Le chargement prend plus de temps..."
3. Bouton "Réessayer" (3 tentatives max)
4. Rechargement de page forcé

### Scénario 5 : Blocage Total
1. Timeout global (10s)
2. `forceReady = true`
3. `window.location.reload()`

## Monitoring et Debugging

### Logs Console
```javascript
// Exemples de logs pour le debugging
'🔒 App devient invisible'
'👁️ App redevient visible, inactivité: 45.2s'
'⚠️ Longue inactivité détectée, marquage pour rafraîchissement'
'🔄 Rafraîchissement automatique après inactivité'
'🔄 Réactivation PWA détectée via Service Worker'
```

### Indicateurs Visuels
- **"Synchronisation en cours..."** : Rafraîchissement post-inactivité
- **"Réactivation #N"** : Compteur de réactivations
- **"Le chargement prend plus de temps..."** : Interface de retry
- **Loading timeout** : Indicateur de timeout

### Métriques Trackées
- Durée d'inactivité
- Nombre de réactivations
- Échecs de retry
- Rechargements forcés

## Configuration

### Variables Importantes
```typescript
// Durées configurables
const INACTIVITY_THRESHOLD = 30000; // 30s
const SW_SUSPENSION_THRESHOLD = 300000; // 5min
const DATALOADER_TIMEOUT = 15000; // 15s
const GLOBAL_TIMEOUT = 10000; // 10s
const HEARTBEAT_INTERVAL = 30000; // 30s
```

### Activation/Désactivation
```typescript
// Dans app/_layout.tsx
const { appWasHidden, reactivationCount } = usePWALifecycle();
// Commentez cette ligne pour désactiver la détection

// Dans DataLoader.tsx
const [showTimeout, setShowTimeout] = useState(false);
// Changez false par true pour forcer l'affichage timeout
```

## Tests

### Test Manuel
1. Ouvrir l'app PWA
2. Changer d'onglet pendant 1 minute
3. Revenir sur l'app
4. Vérifier : "Synchronisation en cours..." apparaît
5. Vérifier : Les données se rechargent

### Test Service Worker
1. Ouvrir DevTools → Application → Service Workers
2. Voir les logs `[SW]` dans la console
3. Vérifier les messages `APP_REACTIVATED`

### Test de Timeout
1. Simuler une connexion lente (DevTools → Network → Slow 3G)
2. Recharger l'app
3. Vérifier : Interface timeout après 15s
4. Cliquer "Réessayer"

## Résultats

### Avant la Solution
- ❌ App bloquée sur loading après inactivité
- ❌ Obligation de fermer/rouvrir l'app
- ❌ Perte de données utilisateur
- ❌ Expérience utilisateur dégradée

### Après la Solution
- ✅ Détection automatique des suspensions
- ✅ Rafraîchissement transparent des données
- ✅ Interface de retry utilisateur
- ✅ Rechargement forcé en dernier recours
- ✅ Monitoring complet des réactivations
- ✅ Expérience utilisateur fluide

## Maintenance

### Monitoring en Production
- Surveiller les logs `⚠️` (suspensions détectées)
- Tracker le nombre de rechargements forcés
- Analyser les patterns d'inactivité

### Optimisations Futures
- Persistance locale avec IndexedDB
- Synchronisation en arrière-plan
- Notification push de réactivation
- Cache intelligent des données critiques

Cette solution garantit une expérience PWA robuste même après des périodes d'inactivité prolongées. 