# 🚀 Guide de Déploiement - Inventory App

## 📋 Vue d'ensemble

Votre application supporte deux méthodes de déploiement, chacune avec ses scripts automatisés :

1. **Expo/EAS** - Pour les déploiements via Expo Application Services
2. **Cloudflare** - Pour les déploiements via GitHub → Cloudflare Pages

## 🎯 Déploiement Expo/EAS

### Commandes disponibles :

```bash
# Déploiement patch (1.2.0 → 1.2.1) - corrections de bugs
npm run deploy:expo

# Déploiement minor (1.2.0 → 1.3.0) - nouvelles fonctionnalités
npm run deploy:expo:minor

# Déploiement major (1.2.0 → 2.0.0) - changements majeurs
npm run deploy:expo:major
```

### Ce qui se passe automatiquement :

1. ✅ **Incrémentation de version** dans `app.json`
2. ✅ **Synchronisation** vers `manifest.json` et `service-worker.js`
3. 📦 **Export Expo** avec `npx expo export --platform web`
4. 🚀 **Déploiement EAS** avec `eas deploy --prod`
5. 🔔 **Notification automatique** aux utilisateurs de la mise à jour

### Prérequis :

- EAS CLI installé : `npm install -g @expo/eas-cli`
- Authentification EAS : `eas login`
- Projet configuré : `eas build:configure`

## ☁️ Déploiement Cloudflare

### Commandes disponibles :

```bash
# Déploiement patch (1.2.0 → 1.2.1) - corrections de bugs
npm run deploy:cloudflare

# Déploiement minor (1.2.0 → 1.3.0) - nouvelles fonctionnalités
npm run deploy:cloudflare:minor

# Déploiement major (1.2.0 → 2.0.0) - changements majeurs
npm run deploy:cloudflare:major
```

### Avec message de commit personnalisé :

```bash
# Exemple avec message personnalisé
node scripts/deploy-cloudflare.js patch "Correction du bug de scanner"
node scripts/deploy-cloudflare.js minor "Ajout de la fonctionnalité export PDF"
```

### Ce qui se passe automatiquement :

1. ✅ **Incrémentation de version** dans `app.json`
2. ✅ **Synchronisation** vers `manifest.json` et `service-worker.js`
3. 📝 **Commit Git** avec message automatique
4. 🚀 **Push vers GitHub**
5. 🏗️ **Build automatique** par Cloudflare Pages
6. 🔔 **Notification automatique** aux utilisateurs de la mise à jour

### Prérequis :

- Repository Git configuré
- Accès push vers GitHub
- Cloudflare Pages connecté au repository

## 🧪 Tests avant déploiement

### Tester le système de mise à jour :

```bash
# Teste l'incrémentation de version et la synchronisation
npm run test-update
```

### Simuler un déploiement :

```bash
# Simuler déploiement Cloudflare
npm run test-deploy cloudflare patch

# Simuler déploiement Expo
npm run test-deploy expo minor
```

### Tester l'application localement :

```bash
# Lancer l'app en mode web
npm run web

# Vérifier que tout fonctionne avant déploiement
```

## 📋 Checklist de déploiement

### Avant chaque déploiement :

- [ ] ✅ Tests locaux passent
- [ ] 🔍 Nouvelles fonctionnalités testées
- [ ] 📝 Documentation mise à jour si nécessaire
- [ ] 🎯 Type de version approprié (patch/minor/major)

### Pour Cloudflare spécifiquement :

- [ ] 📋 `git status` vérifié
- [ ] 🌿 Sur la bonne branche Git
- [ ] 💾 Tous les changements commitées

### Après déploiement :

- [ ] 🌐 Vérifier le déploiement sur le site
- [ ] 🔍 Tester la notification de mise à jour
- [ ] 📊 Vérifier les logs du service worker
- [ ] 👥 Informer l'équipe si nécessaire

## 🔍 Debugging

### Vérifier les versions :

```bash
# Synchroniser manuellement les versions
npm run sync-version

# Vérifier les fichiers
cat app.json | grep version
cat public/manifest.json | grep version
head -1 public/service-worker.js
```

### Logs du service worker :

Ouvrez la console du navigateur pour voir :
```
[SW] Installation du service worker version: 1.2.2
[SW] Nouvelle version détectée: 1.2.2
[SW] Suppression du cache obsolète: inventory-app-cache-v1.2.1
```

### Forcer une mise à jour :

Dans la console du navigateur :
```javascript
// Vérifier manuellement les mises à jour
navigator.serviceWorker.controller.postMessage({ type: 'CHECK_UPDATE' });

// Forcer l'activation d'un nouveau service worker
navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
```

## 🆘 Dépannage

### Problème : "git push" échoue

```bash
# Vérifier le statut
git status

# Vérifier la branche
git branch

# Vérifier les remotes
git remote -v
```

### Problème : EAS deploy échoue

```bash
# Vérifier l'authentification
eas whoami

# Re-login si nécessaire
eas login

# Vérifier la configuration
cat eas.json
```

### Problème : Mise à jour PWA ne fonctionne pas

1. Vider le cache du navigateur (Ctrl+Shift+R)
2. Vérifier la console pour les erreurs
3. Désinstaller le service worker dans DevTools
4. Recharger la page

## 📚 Documentation complète

- 📖 [Guide PWA détaillé](./docs/PWA_UPDATES.md)
- 🔄 [Guide rapide PWA](./README_PWA_UPDATES.md)

---

**Votre système de déploiement est maintenant parfaitement adapté à votre workflow ! 🎯** 