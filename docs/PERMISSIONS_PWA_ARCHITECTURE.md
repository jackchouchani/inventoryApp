# 🏗️ ARCHITECTURE PERMISSIONS & PWA - RÈGLES PROJET

> **Date de création**: Décembre 2024  
> **Version**: 2.0  
> **Status**: ✅ **OBLIGATOIRE - À UTILISER DANS TOUS LES DÉVELOPPEMENTS FUTURS**

## 📋 RÈGLES ABSOLUES

### ❌ INTERDICTIONS

1. **NE JAMAIS** créer de nouveaux fichiers de permissions séparés
2. **NE JAMAIS** utiliser `expo-permissions` (déprécié)
3. **NE JAMAIS** créer de Service Worker pour PWA lifecycle
4. **NE JAMAIS** dupliquer la logique de permissions
5. **NE JAMAIS** gérer manuellement le cache des permissions

### ✅ OBLIGATIONS

1. **TOUJOURS** utiliser `useCameraPermissions` pour la caméra/scanner
2. **TOUJOURS** utiliser `usePWALifecycle` pour les problèmes PWA iOS
3. **TOUJOURS** utiliser `checkPhotoPermissions` pour la galerie photo uniquement
4. **TOUJOURS** configurer des timeouts pour éviter les blocages
5. **TOUJOURS** activer le logging en développement

---

## 🎯 HOOKS OFFICIELS DU PROJET

### 1. `useCameraPermissions` - PERMISSIONS CAMÉRA UNIFIÉES

**Utilisation Standard:**
```typescript
import { useCameraPermissions } from '../hooks/useCameraPermissions';

const MyComponent = () => {
  const permissions = useCameraPermissions({
    enableLogging: __DEV__,  // Logging en dev seulement
    timeoutMs: 10000,        // 10s timeout standard
    maxRetries: 3            // 3 tentatives standard
  });

  // Rendu conditionnel selon l'état
  if (permissions.isLoading) {
    return <LoadingSpinner />;
  }
  
  if (!permissions.isGranted) {
    return (
      <PermissionScreen 
        onRequest={permissions.requestPermission}
        error={permissions.error}
        instructions={permissions.instructions}
      />
    );
  }
  
  return <CameraComponent />;
};
```

**Cas d'usage:**
- ✅ Tous les scanners QR/barcode
- ✅ Caméra pour photos d'articles
- ✅ Fonctionnalités vidéo/livestream

### 2. `usePWALifecycle` - CYCLE DE VIE PWA

**Utilisation Standard:**
```typescript
import { usePWAServiceWorker } from '../hooks/usePWALifecycle';

const App = () => {
  const pwa = usePWAServiceWorker({
    onDataRefreshNeeded: () => {
      // Refresh automatique des données critiques
      store.dispatch({ type: 'items/fetchItems' });
      store.dispatch({ type: 'categories/fetchCategories' });
      store.dispatch({ type: 'containers/fetchContainers' });
    }
  });

  // Monitoring optionnel
  if (pwa.isAppReactivated) {
    console.log(`Réactivation #${pwa.reactivationCount} détectée`);
  }
};
```

**Cas d'usage:**
- ✅ App principal (_layout.tsx)
- ✅ Pages critiques avec données importantes
- ✅ Monitoring/analytics des réactivations PWA

### 3. `checkPhotoPermissions` - GALERIE PHOTO UNIQUEMENT

**Utilisation Standard:**
```typescript
import { checkPhotoPermissions } from '../utils/permissions';

const handleImagePicker = async () => {
  const hasPermission = await checkPhotoPermissions();
  if (!hasPermission) return;
  
  // Continuer avec ImagePicker
  const result = await ImagePicker.launchImageLibraryAsync({...});
};
```

**Cas d'usage:**
- ✅ Sélection d'images depuis la galerie
- ✅ Formulaires d'ajout/édition d'articles
- ❌ PAS pour la caméra (utiliser useCameraPermissions)

---

## 🔧 CONFIGURATIONS RECOMMANDÉES

### Development (DEV)
```typescript
const permissions = useCameraPermissions({
  enableLogging: true,        // Debug actif
  timeoutMs: 15000,          // Plus de temps pour debug
  maxRetries: 5              // Plus de tentatives
});
```

### Production (PROD)
```typescript
const permissions = useCameraPermissions({
  enableLogging: false,       // Pas de logs
  timeoutMs: 10000,          // Timeout standard
  maxRetries: 3              // Tentatives limitées
});
```

### PWA iOS Critique
```typescript
const pwa = usePWAServiceWorker({
  inactivityThreshold: 30000,    // 30s (standard)
  enableAutoRefresh: true,       // Auto-refresh activé
  onDataRefreshNeeded: refreshData
});
```

---

## 🚨 TROUBLESHOOTING GUIDE

### Problème: Scanner bloqué sur "Initialisation"
```typescript
// ✅ SOLUTION CORRECTE
const permissions = useCameraPermissions({
  timeoutMs: 8000,          // Réduire timeout
  maxRetries: 2,            // Moins de tentatives
  enableLogging: true       // Activer debug
});

// Dans le composant
useEffect(() => {
  if (permissions.error) {
    console.error('Permission error:', permissions.error);
    // Afficher fallback UI ou redirection
  }
}, [permissions.error]);
```

### Problème: Permissions redemandées
```typescript
// ✅ VÉRIFIER LA CLÉ DE PERSISTANCE
const permissions = useCameraPermissions({
  persistenceKey: '@app:camera_permission_v2'  // Clé correcte
});

// ✅ VÉRIFIER LE STORAGE
if (Platform.OS === 'web') {
  console.log('Stored permission:', localStorage.getItem('@app:camera_permission_v2'));
}
```

### Problème: PWA iOS bloquée après inactivité
```typescript
// ✅ SOLUTION CORRECTE
const pwa = usePWAServiceWorker({
  inactivityThreshold: 20000,    // Réduire seuil
  enableAutoRefresh: true,
  onDataRefreshNeeded: () => {
    // OBLIGATOIRE: Refresh des données
    refreshCriticalData();
  }
});
```

---

## 📁 STRUCTURE FICHIERS RECOMMANDÉE

```
src/
├── hooks/
│   ├── useCameraPermissions.ts     ✅ Hook unifié caméra
│   ├── usePWALifecycle.ts         ✅ Hook PWA moderne
│   └── [AUTRES_HOOKS]
├── utils/
│   ├── permissions.ts             ✅ Seulement checkPhotoPermissions
│   └── [AUTRES_UTILS]
└── components/
    ├── Scanner/                   ✅ Utilise useCameraPermissions
    ├── ItemForm/                  ✅ Utilise checkPhotoPermissions
    └── [AUTRES_COMPONENTS]
```

### ❌ FICHIERS INTERDITS (À NE JAMAIS RECRÉER)

```
❌ src/hooks/useScannerPermissions.ts
❌ src/hooks/usePWAServiceWorker.ts  
❌ src/hooks/usePermissions.ts
❌ src/services/permissions.ts
❌ src/utils/pwaPermissions.ts
❌ Tout autre fichier de permissions
```

---

## 🧪 TESTS OBLIGATOIRES

### Avant chaque release:

1. **Test Scanner PWA iOS:**
   ```bash
   # 1. Ouvrir Safari iOS
   # 2. Ajouter à l'écran d'accueil
   # 3. Lancer depuis l'écran d'accueil
   # 4. Aller sur Scanner
   # 5. Vérifier: pas de loading infini
   ```

2. **Test Permissions Persistantes:**
   ```typescript
   // 1. Première utilisation → Autoriser caméra
   // 2. Fermer/rouvrir app
   // 3. Vérifier: pas de nouvelle demande
   // 4. Check localStorage: '@app:camera_permission_v2' = 'granted'
   ```

3. **Test Réactivation PWA:**
   ```bash
   # 1. Ouvrir PWA iOS
   # 2. Quitter app 30s+
   # 3. Revenir → doit auto-refresh
   # 4. Vérifier logs: "Réactivation PWA détectée"
   ```

---

## 📈 MONITORING & ANALYTICS

### Métriques à Tracker:

```typescript
// Dans vos analytics
const permissions = useCameraPermissions();
const pwa = usePWAServiceWorker();

// Tracker les problèmes
useEffect(() => {
  if (permissions.error) {
    analytics.track('Permission_Error', {
      error: permissions.error,
      platform: Platform.OS,
      retryCount: permissions.retryCount
    });
  }
}, [permissions.error]);

// Tracker les réactivations PWA
useEffect(() => {
  if (pwa.isAppReactivated) {
    analytics.track('PWA_Reactivated', {
      reactivationCount: pwa.reactivationCount,
      timeSinceLastActivity: pwa.timeSinceLastActivity
    });
  }
}, [pwa.isAppReactivated]);
```

---

## 🔄 MIGRATION GUIDE

### Si vous trouvez du vieux code:

1. **Identifier le pattern obsolète:**
   ```typescript
   // ❌ ANCIEN PATTERN
   const [permission, requestPermission] = useCameraPermissions();
   ```

2. **Migrer vers le nouveau:**
   ```typescript
   // ✅ NOUVEAU PATTERN
   const permissions = useCameraPermissions();
   
   // Remplacer:
   permission?.granted → permissions.isGranted
   requestPermission() → permissions.requestPermission()
   ```

3. **Supprimer imports obsolètes:**
   ```typescript
   // ❌ SUPPRIMER
   import { useScannerPermissions } from '...';
   import { usePWAServiceWorker } from '../hooks/usePWAServiceWorker';
   
   // ✅ REMPLACER PAR
   import { useCameraPermissions } from '../hooks/useCameraPermissions';
   import { usePWAServiceWorker } from '../hooks/usePWALifecycle';
   ```

---

## 🎓 FORMATION ÉQUIPE

### Pour nouveaux développeurs:

1. **Lire ce document EN ENTIER**
2. **Comprendre les 3 hooks principaux**
3. **Tester sur PWA iOS avant de commit**
4. **Demander code review pour permissions/PWA**

### Pour code reviews:

- ✅ Vérifier usage des hooks officiels
- ✅ Vérifier timeouts configurés
- ✅ Vérifier gestion d'erreurs
- ❌ Rejeter tout nouveau fichier de permissions

---

## 🚀 ÉVOLUTIONS FUTURES

### À NE PAS FAIRE:
- ❌ Créer de nouveaux hooks de permissions
- ❌ Modifier les hooks existants sans consensus équipe
- ❌ Bypasser le système pour "cas spéciaux"

### À FAIRE EN CAS DE BESOIN:
- ✅ Étendre les hooks existants avec nouvelles options
- ✅ Améliorer la documentation
- ✅ Ajouter de nouveaux tests
- ✅ Optimiser les performances

---

## 📞 SUPPORT

### En cas de problème:
1. **Lire ce document**
2. **Vérifier les logs de debug**
3. **Tester les configurations recommandées**
4. **Demander sur Slack #dev-mobile**

### Contact technique:
- **Architecture**: Lead Dev
- **PWA iOS**: Expert iOS
- **Permissions**: Security Team

---

> **⚠️ IMPORTANT**: Ce document fait loi dans le projet. Toute déviation doit être validée par l'équipe technique et documentée ici.

> **🔄 MISE À JOUR**: Ce document doit être mis à jour à chaque évolution majeure de l'architecture permissions/PWA. 