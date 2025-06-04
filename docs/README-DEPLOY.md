# 🚀 Guide de Déploiement InventoryApp

Ce guide explique comment utiliser les différentes commandes de déploiement de l'application.

## 📱 Types de Déploiement

### 1. **Déploiement Simultané (Both)** - ⭐ Recommandé
Déploie simultanément sur Expo/EAS et Cloudflare Pages.

```bash
# Déploiement patch (défaut)
npm run deploy:both

# Déploiement avec version minor
npm run deploy:both:minor

# Déploiement avec version major
npm run deploy:both:major
```

### 2. **Déploiement Web Seulement**
Déploie uniquement sur Cloudflare Pages (version web/PWA).

```bash
# Déploiement patch
npm run deploy:web

# Déploiement minor
npm run deploy:web:minor

# Déploiement major
npm run deploy:web:major
```

### 3. **Déploiement Mobile Seulement**
Déploie uniquement sur Expo/EAS (version mobile native).

```bash
# Déploiement patch
npm run deploy:mobile-tested

# Déploiement minor
npm run deploy:mobile-tested:minor

# Déploiement major
npm run deploy:mobile-tested:major
```

## 🔢 Types de Version

- **patch** : Corrections de bugs (1.0.0 → 1.0.1)
- **minor** : Nouvelles fonctionnalités (1.0.0 → 1.1.0)
- **major** : Changements majeurs (1.0.0 → 2.0.0)

## 🛠️ Commandes Séparées (Avancé)

Si vous préférez déployer manuellement chaque plateforme :

### Expo/EAS Seulement
```bash
npm run deploy:expo           # patch
npm run deploy:expo:minor     # minor
npm run deploy:expo:major     # major
```

### Cloudflare Seulement
```bash
npm run deploy:cloudflare           # patch
npm run deploy:cloudflare:minor     # minor
npm run deploy:cloudflare:major     # major
```

## 🔄 Processus de Déploiement

### Étapes Automatiques

1. **Synchronisation des versions** (`npm run sync-version`)
2. **Tests d'images mobiles** (pour deployments expo)
3. **Build et upload**
4. **Affichage des liens et conseils de test**

### Pour `deploy:both`

1. ✅ Sync versions
2. 📱 Tests images mobiles
3. 🚀 Lance déploiement Expo en arrière-plan
4. ☁️  Lance déploiement Cloudflare immédiatement
5. ⏳ Attend la fin du déploiement Expo

## 📋 Tests Post-Déploiement

### Mobile (Expo)
- ✅ Sélection d'images sur mobile
- ✅ Aperçu des images
- ✅ Upload et sauvegarde
- ✅ Scanner natif

### Web (Cloudflare)
- ✅ Scanner PWA
- ✅ Fonctionnalités offline
- ✅ Compatibilité navigateurs
- ✅ Gestion des images web

## 🔗 Liens Utiles

### Expo/EAS
- Dashboard: https://expo.dev/accounts/[username]/projects/inventoryapp
- Commandes utiles:
  ```bash
  npx expo login
  npx eas whoami
  npx eas build --platform all
  ```

### Cloudflare Pages
- Dashboard: https://inventory.comptoirvintage.com
- Commandes utiles:
  ```bash
  npx wrangler whoami
  npx wrangler pages list
  npx wrangler pages deployment list
  ```

## 🔧 Résolution de Problèmes

### Erreurs Expo
```bash
# Vérifier l'authentification
npx expo login

# Vérifier la configuration
cat app.json

# Vérifier les permissions EAS
npx eas whoami
```

### Erreurs Cloudflare
```bash
# Vérifier l'authentification Wrangler
npx wrangler whoami

# Vérifier la configuration
cat wrangler.toml

# Re-authentifier si nécessaire
npx wrangler login
```

### Erreurs de Build
```bash
# Nettoyer le cache
npm run clean

# Synchroniser les versions
npm run sync-version

# Tester en local
npm run web
```

## 💡 Conseils

1. **Utilisez `deploy:both`** pour la plupart des déploiements
2. **Testez en local** avant de déployer avec `npm run web`
3. **Vérifiez les versions** dans `package.json` et `app.json`
4. **Documentez les changements** dans le commit avant de déployer

## 🚨 Important

- Les déploiements modifient automatiquement les numéros de version
- Assurez-vous d'avoir commit vos changements avant de déployer
- Les tests d'images mobiles peuvent être ignorés s'ils échouent
- Le déploiement simultané peut prendre plusieurs minutes 