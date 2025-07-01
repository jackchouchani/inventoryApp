# Project Development Guidelines

This document contains a collection of rules, conventions, and architectural guidelines for this project. Please adhere to these standards to ensure consistency, performance, and maintainability.

---
*From: @.cursor/rules/react-native-conventions.mdc*
---
# Conventions React Native/Expo - Bonnes Pratiques

## Stack Technologique

### Framework Principal
- **React Native** avec **Expo Router** (file-based routing)
- **Redux Toolkit** pour la gestion d'état
- **TypeScript** obligatoire
- **Supabase** pour la base de données

### Plateforme Cible
- **Web App** principalement (ne pas s'occuper d'iOS/Android natif)
- Compatible mobile via responsive design
- PWA capabilities

## Structure de Navigation

### Router Structure
```
app/
  (auth)/           # Routes d'authentification
  (stack)/          # Stack navigation
  (tabs)/           # Tab navigation principale
    stock.tsx       # Page inventaire
    add.tsx         # Ajout d'article
  item/
    _layout.tsx     # Layout navigation items
    [id]/
      _layout.tsx   # Layout avec header
      info.tsx      # Informations article
      edit.tsx      # Édition article
```

### Navigation Pattern
```typescript
// ✅ CORRECT - Navigation avec Expo Router
import { useRouter } from 'expo-router';
const router = useRouter();
router.push(`/item/${item.id}/edit`);

// ❌ ÉVITER - Navigation manuelle complexe
navigation.navigate('EditScreen', { itemId: item.id });
```

## Gestion des Composants

### Structure des Composants
```typescript
// ✅ Pattern de composant TypeScript
interface ComponentProps {
  item: Item;
  onPress: (item: Item) => void;
}

const Component: React.FC<ComponentProps> = ({ item, onPress }) => {
  // Logique composant
  return (
    // JSX
  );
};

export default Component;
```

### Hooks Pattern
- **Custom hooks** dans `src/hooks/`
- **Redux hooks** préférés aux hooks React Query
- **useMemo** pour éviter re-renders inutiles

Référence : [src/hooks/useItem.ts](mdc:src/hooks/useItem.ts)

## Gestion des Thèmes

### Theme Provider
```typescript
import { useAppTheme } from '../../src/contexts/ThemeContext';

const Component = () => {
  const { activeTheme } = useAppTheme();
  
  return (
    <View style={{ backgroundColor: activeTheme.background }}>
      <Text style={{ color: activeTheme.text.primary }}>
        Content
      </Text>
    </View>
  );
};
```

### Styles Responsables
```typescript
const getThemedStyles = (theme: AppThemeType, insets?: { bottom: number }) => StyleSheet.create({
  container: {
    backgroundColor: theme.background,
    paddingBottom: insets?.bottom || 0,
  },
  // Platform-specific styles
  searchBox: {
    padding: Platform.OS === 'web' ? 12 : 8,
  }
});
```

## Gestion d'État Redux

### Store Structure
```
src/store/
  store.ts              # Configuration Redux
  itemsSlice.ts         # Slice items
  itemsThunks.ts        # Thunks async
  itemsAdapter.ts       # Entity adapter
  categorySlice.ts      # Slice categories
  containersSlice.ts    # Slice containers
```

### Thunks Pattern
```typescript
// ✅ Thunk avec createAsyncThunk
export const fetchItems = createAsyncThunk(
  'items/fetchItems',
  async ({ page, limit }: { page: number; limit: number }) => {
    const items = await database.getItems(page, limit);
    return items;
  }
);
```

Référence : [src/store/itemsThunks.ts](mdc:src/store/itemsThunks.ts)

## Gestion des Formulaires

### Pattern d'Adaptation des Données
```typescript
// ✅ Adaptation snake_case → camelCase avec useMemo
const adaptedItem = useMemo(() => ({
  ...item,
  purchasePrice: item.purchase_price || 0,
  sellingPrice: item.selling_price || 0,
  // ... autres mappings
}), [item]);

// Utiliser adaptedItem dans les formulaires
<ItemForm initialData={adaptedItem} />
```

### Validation et Protection
```typescript
// ✅ Protection contre undefined
const displayPrice = (item?.sellingPrice || 0).toString();
const categoryName = category?.name || 'Non spécifiée';
```

## Gestion des Erreurs

### Error Boundaries
```typescript
// ✅ Wrapper avec ErrorBoundary
export default function Screen() {
  return (
    <ErrorBoundary>
      <ScreenContent />
    </ErrorBoundary>
  );
}
```

Référence : [src/components/ErrorBoundary.tsx](mdc:src/components/ErrorBoundary.tsx)

### Error Handling Pattern
```typescript
// ✅ Gestion d'erreur avec try/catch
try {
  await dispatch(updateItemStatus({ itemId, status })).unwrap();
} catch (error) {
  console.error('Update failed:', error);
  // Afficher message d'erreur utilisateur
}
```

## Performance et Optimisation

### Memoization Pattern
```typescript
// ✅ Memo pour composants lourds
const MemoizedItemList = React.memo(ItemList);

// ✅ useMemo pour calculs coûteux
const filteredItems = useMemo(() => {
  return items.filter(item => /* logique filtre */);
}, [items, filters]);

// ✅ useCallback pour fonctions stables
const handlePress = useCallback((item: Item) => {
  router.push(`/item/${item.id}/info`);
}, [router]);
```

### Éviter Re-renders
```typescript
// ✅ useRef pour valeurs stables
const stableCallbacks = useRef({
  handleItemPress: (item: Item) => setSelectedItem(item),
  // ... autres callbacks
});
```

## Responsive Design

### Platform Detection
```typescript
// ✅ Adaptations platform-specific
const styles = StyleSheet.create({
  container: {
    padding: Platform.OS === 'web' ? 12 : 8,
    borderWidth: Platform.OS === 'web' ? 1 : 0,
  }
});
```

### Safe Area Handling
```typescript
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Component = () => {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={{ paddingTop: insets.top }}>
      {/* Content */}
    </View>
  );
};
```

## Fichiers de Référence

### Composants Modèles
- [src/components/ItemList.tsx](mdc:src/components/ItemList.tsx)
- [src/components/ItemForm.tsx](mdc:src/components/ItemForm.tsx)
- [app/(tabs)/stock.tsx](mdc:app/(tabs))

### Configuration
- [app.json](mdc:app.json) - Configuration Expo
- [tsconfig.json](mdc:tsconfig.json) - Configuration TypeScript
- [metro.config.js](mdc:metro.config.js) - Configuration Metro bundler

Ces conventions garantissent un code maintenable et performant pour l'application inventory.

---
*From: @.cursor/rules/database-schema.mdc*
---
# Structure Base de Données - Schéma de Référence

## Modèle d'Accès aux Données

### Principe Fondamental d'Accès
**TOUS les utilisateurs ont accès à TOUTES les données** (items, containers, categories).

Il n'y a **AUCUN filtrage par user_id** dans les requêtes de lecture :
- `getItems()` → Tous les items où `deleted = false`
- `getContainers()` → Tous les containers où `deleted = false`  
- `getCategories()` → Toutes les categories où `deleted = false`

### Rôle du champ `user_id`
Le champ `user_id` sert **UNIQUEMENT pour la traçabilité** :
- **Identifier qui a créé/modifié** un enregistrement
- **Audit et historique** des modifications
- **PAS pour limiter l'accès** aux données

### Filtrage Autorisé
- **Seul filtre autorisé** : `deleted = false` (soft delete)
- **Jamais de filtre** : `.eq('user_id', user.id)` dans les requêtes de lecture
- **Exception** : Création d'enregistrements nécessite `user_id` pour traçabilité

### Exemples de Requêtes Correctes
```typescript
// ✅ CORRECT - Lecture sans filtre user_id
const { data } = await supabase
  .from('containers')
  .select('*')
  .eq('deleted', false);

// ✅ CORRECT - Création avec user_id pour traçabilité
const { data } = await supabase
  .from('items')
  .insert({
    name: 'Item',
    user_id: user.id,  // Pour traçabilité
    created_by: user.id
  });

// ❌ INTERDIT - Filtrage par user_id en lecture
const { data } = await supabase
  .from('containers')
  .select('*')
  .eq('deleted', false)
  .eq('user_id', user.id);  // ❌ Limite l'accès incorrectement
```

## Tables Principales

### Table `items`
```sql
id: int8 (PK, Auto-increment)
name: text
description: text
purchase_price: numeric
selling_price: numeric
status: text  -- 'available' | 'sold'
qr_code: text
container_id: int8 (FK → containers.id)
category_id: int8 (FK → categories.id)
created_at: timestamptz
updated_at: timestamptz
sold_at: timestamptz
created_by: uuid (FK → auth.users.id)
deleted: bool
user_id: uuid (FK → auth.users.id)
photo_storage_url: text
```

### Table `categories`
```sql
id: int8 (PK, Auto-increment)
name: text
description: text
created_at: timestamptz
updated_at: timestamptz
deleted: bool
user_id: uuid (FK → auth.users.id)
icon: text
```

### Table `containers`
```sql
id: int8 (PK, Auto-increment)
number: int4
name: text
description: text
qr_code: text
created_at: timestamptz
updated_at: timestamptz
deleted: bool
user_id: uuid (FK → auth.users.id)
```

## Relations de Clés Étrangères

### Items
- `items.container_id` → `containers.id`
- `items.category_id` → `categories.id`
- `items.created_by` → `auth.users.id`
- `items.user_id` → `auth.users.id`

### Categories & Containers
- `categories.user_id` → `auth.users.id`
- `containers.user_id` → `auth.users.id`

## Conventions de Nommage

### Base de Données (PostgreSQL/Supabase)
- **Convention** : `snake_case`
- **Exemples** : `purchase_price`, `selling_price`, `container_id`, `category_id`
- **Dates** : `created_at`, `updated_at`, `sold_at`
- **URLs** : `photo_storage_url`

### Interface TypeScript
- **Convention** : `camelCase`  
- **Exemples** : `purchasePrice`, `sellingPrice`, `containerId`, `categoryId`
- **Dates** : `createdAt`, `updatedAt`, `soldAt`
- **URLs** : `photoStorageUrl`

## Types TypeScript de Référence

### Interface Item
```typescript
interface Item {
  id: number;
  name: string;
  description: string;
  purchasePrice: number;
  sellingPrice: number;
  status: 'available' | 'sold';
  qrCode: string;
  containerId: number;
  categoryId: number;
  createdAt: string;
  updatedAt: string;
  soldAt?: string;
  createdBy: string;
  deleted: boolean;
  userId: string;
  photoStorageUrl?: string;
}
```

Référence : [src/types/item.ts](mdc:src/types/item.ts)

### Interface Category 
```typescript
interface Category {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  userId: string;
  icon?: string;
}
```

Référence : [src/types/category.ts](mdc:src/types/category.ts)

### Interface Container
```typescript
interface Container {
  id: number;
  number: number;
  name: string;
  description: string;
  qrCode: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  userId: string;
}
```

Référence : [src/types/container.ts](mdc:src/types/container.ts)

## Gestion des Statuts

### Statuts Item
- `available` : Article disponible à la vente
- `sold` : Article vendu (avec `sold_at` renseigné)

### Logique Business
- Passage `available` → `sold` : Définir `sold_at` + `selling_price` final
- Passage `sold` → `available` : Effacer `sold_at`
- Soft delete : `deleted = true` (ne pas supprimer physiquement)

## Service Database

### Référence d'Implémentation
- [src/database/database.ts](mdc:src/database/database.ts)
- Toutes les requêtes Supabase centralisées
- Gestion automatique de la conversion snake_case ↔ camelCase
- Filtrage automatique `deleted = false`

### Exemples de Requêtes
```typescript
// Récupération avec relations
const items = await database.getItems();
// Retourne automatiquement en camelCase

// Mise à jour
await database.updateItem(id, {
  sellingPrice: 100,  // Converti en selling_price
  status: 'sold'
});
```

Cette structure garantit la cohérence entre la base de données PostgreSQL et l'interface TypeScript.

---
*From: @.cursor/rules/redux-architecture.mdc*
---
# Architecture Redux Pure - Règles Obligatoires ✅ MIGRATION COMPLÈTE

## 🎯 Statut de Migration (Mise à jour Décembre 2024)

### ✅ **MIGRATION REDUX TERMINÉE AVEC SUCCÈS**
- **Aucune référence React Query** restante dans le codebase
- **Architecture Redux pure** pour toutes les entités principales
- **Bug de synchronisation articles vendus/restockés RÉSOLU**
- **Pattern d'invalidation cohérent** établi dans toute l'application

### 📁 **Fichiers Migrés avec Succès**
- ✅ `app/(stack)/multi-receipt.tsx` - React Query complètement supprimé
- ✅ `app/(stack)/containers.tsx` - `useQueryClient` supprimé, remplacé par `dispatch(fetchItems())`
- ✅ `src/components/ItemEditForm.tsx` - Gestion état query complexe supprimée
- ✅ `src/components/ItemForm.tsx` - `useMutation` remplacée par fonction directe
- ✅ `src/hooks/useStats.ts` - Migré vers hooks Redux (`useItems`, `useCategories`)
- ✅ `app/(stack)/labels.tsx` - Imports React Query nettoyés

### 🔍 **Vérification Technique**
```bash
# Vérification aucune référence React Query (✅ Validé)
grep -r "useQuery\|useMutation\|useQueryClient\|@tanstack/react-query" --include="*.ts" --include="*.tsx" .
# Résultat: 0 match trouvé
```

## Gestion d'État - Entités Principales

**TOUJOURS utiliser Redux pour les entités principales, JAMAIS React Query :**

### Entités Concernées
- **Items** : Utiliser Redux store + thunks SEULEMENT
- **Categories** : Utiliser Redux store + slice SEULEMENT  
- **Containers** : Utiliser Redux store + slice SEULEMENT

### Hooks Redux Obligatoires
```typescript
// ✅ CORRECT - Utiliser ces hooks Redux
import { useItems } from '../../src/hooks/useItems';
import { useCategories } from '../../src/hooks/useCategories'; 
import { useContainers } from '../../src/hooks/useContainers';
import { useItem } from '../../src/hooks/useItem'; // Pour un item spécifique

// ❌ INTERDIT - Ne jamais utiliser React Query pour ces entités
import { useQuery } from '@tanstack/react-query';
```

### Thunks Redux Disponibles
- `fetchItems` - Récupération paginée des items
- `fetchItemById` - Récupération d'un item spécifique
- `updateItemStatus` - Mise à jour du statut (sold/available)
- Référence : [src/store/itemsThunks.ts](mdc:src/store/itemsThunks.ts)

## Format des Données - Conversion Obligatoire

### Règle de Mapping
- **Base de données** : snake_case (`purchase_price`, `selling_price`, `container_id`, `category_id`)
- **Redux/Frontend** : camelCase (`purchasePrice`, `sellingPrice`, `containerId`, `categoryId`)

### Pattern d'Adaptation Required
```typescript
// ✅ PATTERN OBLIGATOIRE pour les composants recevant des données DB
const adaptedItem = useMemo(() => ({
  ...item,
  purchasePrice: item.purchase_price || 0,
  sellingPrice: item.selling_price || 0,
  containerId: item.container_id,
  categoryId: item.category_id,
  photoStorageUrl: item.photo_storage_url,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
  soldAt: item.sold_at,
  createdBy: item.created_by,
  userId: item.user_id
}), [item]);
```

## Navigation - Routes Dédiées

### Structure de Routes Obligatoire
```
app/
  item/
    _layout.tsx          # Navigation principale
    [id]/
      _layout.tsx        # Layout avec header navigation
      info.tsx          # Page d'informations détaillées
      edit.tsx          # Page d'édition
```

### Redirection au lieu de Modals
```typescript
// ✅ CORRECT - Utiliser la navigation
router.push(`/item/${item.id}/edit`);
router.push(`/item/${item.id}/info`);

// ❌ ÉVITER - Plus de modals pour edit/info
setShowEditModal(true);
```

## Synchronisation d'État

### Règles de Mutation
- **Toutes les mutations** DOIVENT passer par Redux thunks
- **Invalidation automatique** via Redux, pas de `window.location.reload()`
- **État global synchronisé** sur tous les composants

### Pattern de Mise à Jour ✅ CONFIRMÉ
```typescript
// ✅ CORRECT - Mutation via Redux (Pattern validé dans migration)
const dispatch = useDispatch<AppDispatch>();
await dispatch(updateItemStatus({ itemId, status }));

// ✅ INVALIDATION REDUX - Remplace queryClient.invalidateQueries()
await dispatch(fetchItems({ page: 0, limit: 1000 }));

// ❌ INTERDIT - Mutations directes Supabase dans composants
await database.updateItem(itemId, data);

// ❌ INTERDIT - Invalidation React Query (supprimé de toute l'app)
queryClient.invalidateQueries({ queryKey: ['items'] });
```

## Éviter les Conflits de Cache ✅ RÉSOLU

### Problèmes RÉSOLUS par la Migration
- ✅ **Fin du mélange React Query + Redux** pour même entité
- ✅ **Fin des items mis à jour via Redux mais lus via React Query**
- ✅ **Fin du cache désynchronisé** entre sources de données
- ✅ **Bug articles vendus/restockés CORRIGÉ**

### Solutions Implémentées ✅ CONFIRMÉES
- ✅ **Migration complète vers Redux** pour entités principales
- ✅ **Hooks Redux uniformes** dans toute l'application
- ✅ **Invalidation cohérente** via store Redux uniquement
- ✅ **Pattern dispatch unique** : `dispatch(fetchItems())` au lieu de `queryClient.invalidateQueries()`

## Composants - Bonnes Pratiques ✅ VALIDÉES

### Adaptation des Données dans les Composants
Référence d'implémentation : [app/item/[id]/edit.tsx](mdc:app/item/[id]/edit.tsx)

```typescript
// ✅ Pattern adapté pour éviter les re-renders infinis (validé dans migration)
const adaptedItem = useMemo(() => ({
  // mapping snake_case vers camelCase
}), [item]);

// Utiliser adaptedItem dans le composant, pas item directement
```

### Gestion d'Erreurs
```typescript
// ✅ Protection contre propriétés undefined
const displayPrice = (salePrice || 0).toString();
const categoryName = category?.name || 'Non spécifiée';
```

### TypeScript Dispatch Pattern ✅ CONFIRMÉ
```typescript
// ✅ OBLIGATOIRE - Typage dispatch correct (validé dans migration)
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../src/store/store';

const dispatch = useDispatch<AppDispatch>();
```

## Fichiers de Référence ✅ VALIDÉS

### Hooks Redux
- [src/hooks/useItems.ts](mdc:src/hooks/useItems.ts) ✅ Validé
- [src/hooks/useCategories.ts](mdc:src/hooks/useCategories.ts) ✅ Validé
- [src/hooks/useContainers.ts](mdc:src/hooks/useContainers.ts) ✅ Validé
- [src/hooks/useItem.ts](mdc:src/hooks/useItem.ts) ✅ Validé

### Store Redux
- [src/store/itemsThunks.ts](mdc:src/store/itemsThunks.ts) ✅ Validé
- [src/store/itemsSlice.ts](mdc:src/store/itemsSlice.ts) ✅ Validé
- [src/store/categorySlice.ts](mdc:src/store/categorySlice.ts) ✅ Validé
- [src/store/containersSlice.ts](mdc:src/store/containersSlice.ts) ✅ Validé

### Pages Modèles ✅ MIGRÉES
- [app/item/[id]/info.tsx](mdc:app/item/[id]/info.tsx) ✅ Migré
- [app/item/[id]/edit.tsx](mdc:app/item/[id]/edit.tsx) ✅ Migré
- [app/(tabs)/add.tsx](mdc:app/(tabs)/add.tsx) ✅ Validé

## Exemples d'Usage Correct ✅ CONFIRMÉS

### Chargement d'Items
```typescript
const { data: items, isLoading, error } = useItems();
// ✅ Validé - Pas useQuery pour les items
```

### Récupération Item Spécifique
```typescript
const { item, isLoading } = useItem(itemId);
// ✅ Validé - Utilise Redux thunk fetchItemById
```

### Mise à Jour de Statut
```typescript
await dispatch(updateItemStatus({ 
  itemId: item.id.toString(), 
  status: 'sold',
  soldDate: new Date().toISOString(),
  salePrice: 100
}));
// ✅ Validé - Pattern utilisé dans migration
```

## 🚫 Patterns INTERDITS (Supprimés avec Succès)

### ❌ React Query pour Entités Principales
```typescript
// ❌ SUPPRIMÉ de toute l'application
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
const { data: items } = useQuery(['items'], fetchItems);
const mutation = useMutation(updateItem);
queryClient.invalidateQueries(['items']);
```

### ❌ Mélange React Query + Redux
```typescript
// ❌ PROBLÈME RÉSOLU - Plus de conflit cache
const { data: items } = useQuery(['items']); // Lecture React Query
await dispatch(updateItem()); // Mutation Redux
// ↑ Ce pattern causait le bug de synchronisation articles vendus/restockés
```

## 📊 Résultats de la Migration

### Métriques de Succès
- **0 référence React Query** dans le codebase
- **6 fichiers migrés** avec succès
- **1 bug critique résolu** (articles vendus/restockés)
- **100% architecture Redux** pour entités principales
- **Pattern d'invalidation uniforme** établi

### Vérification Continue
```bash
# Commande de vérification à exécuter régulièrement
npx tsc --noEmit --skipLibCheck | grep -i "react-query\|@tanstack"
# Résultat attendu: aucune erreur React Query
```

Cette architecture Redux pure garantit une synchronisation cohérente et **élimine définitivement** les conflits de cache entre React Query et Redux.

# Architecture Redux - Accès aux Données

## Principe Fondamental

**JAMAIS d'accès direct à `database` dans les composants ou hooks.**

Toutes les opérations de données DOIVENT passer par Redux thunks et hooks optimisés.

## Hooks Obligatoires

### Pour les Items
```typescript
// ✅ CORRECT - Utiliser les hooks optimisés
import { useStockPageData, useFilteredItems } from '../../src/hooks/useOptimizedSelectors';

const { items, categories, containers, isLoading } = useStockPageData(filters);
```

### Pour les Categories
```typescript
// ✅ CORRECT - Hook optimisé Redux
import { useCategoriesOptimized as useCategories } from '../../src/hooks/useCategoriesOptimized';

const { categories, isLoading, error, create, update, delete } = useCategories();
```

### Pour les Containers
```typescript
// ✅ CORRECT - Hook optimisé Redux
import { useContainersOptimized as useContainers } from '../../src/hooks/useContainersOptimized';

const { containers, isLoading, error, create, update, delete } = useContainers();
```

## Thunks Redux Disponibles

### Items - [src/store/itemsThunks.ts](mdc:src/store/itemsThunks.ts)
```typescript
import { createItem, updateItem, deleteItem, fetchItems, updateItemStatus } from '../store/itemsThunks';

// Créer un item
await dispatch(createItem({
  name: 'Item Name',
  description: 'Description',
  purchasePrice: 100,
  sellingPrice: 150,
  categoryId: 1,
  containerId: 2,
  qrCode: 'ITEM123'
})).unwrap();

// Mettre à jour un item
await dispatch(updateItem({
  id: itemId,
  updates: { name: 'Nouveau nom', sellingPrice: 200 }
})).unwrap();

// Supprimer un item
await dispatch(deleteItem(itemId)).unwrap();
```

### Categories - [src/store/categoriesThunks.ts](mdc:src/store/categoriesThunks.ts)
```typescript
import { createCategory, updateCategory, deleteCategory, fetchCategories } from '../store/categoriesThunks';

// Créer une catégorie
await dispatch(createCategory({
  name: 'Nouvelle Catégorie',
  description: 'Description',
  icon: 'folder'
})).unwrap();
```

### Containers - [src/store/containersThunks.ts](mdc:src/store/containersThunks.ts)
```typescript
import { createContainer, updateContainer, deleteContainer, fetchContainers } from '../store/containersThunks';

// Créer un container
await dispatch(createContainer({
  name: 'Container Name',
  description: 'Description',
  number: 1
})).unwrap();
```

## Patterns Obligatoires

### Pattern Dispatch TypeScript
```typescript
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';

const Component = () => {
  const dispatch = useDispatch<AppDispatch>();
  
  const handleSubmit = async () => {
    try {
      await dispatch(createItem(itemData)).unwrap();
      // Succès
    } catch (error) {
      // Gestion d'erreur
    }
  };
};
```

### Pattern Hook Optimisé
```typescript
// ✅ CORRECT - Une seule récupération de données
const { items, categories, containers, isLoading } = useStockPageData(filters);

// ❌ ÉVITER - Multiples hooks séparés
const items = useItems();
const categories = useCategories(); 
const containers = useContainers();
```

## Interdictions Absolues

### ❌ Import Database Direct
```typescript
// ❌ INTERDIT - Accès direct database
import { database } from '../database/database';
await database.addItem(itemData);

// ✅ CORRECT - Redux thunk
import { createItem } from '../store/itemsThunks';
await dispatch(createItem(itemData)).unwrap();
```

### ❌ Hooks Dépréciés
```typescript
// ❌ ÉVITER - Hooks dépréciés
import { useCategories } from './useCategories';
import { useContainers } from './useContainers';

// ✅ UTILISER - Hooks optimisés
import { useCategoriesOptimized as useCategories } from './useCategoriesOptimized';
import { useContainersOptimized as useContainers } from './useContainersOptimized';
```

## Services Autorisés

### Exception : Services Spécialisés
Seuls les services suivants peuvent accéder directement à `database` :
- [src/services/imageService.ts](mdc:src/services/imageService.ts) - Gestion images R2
- [src/database/](mdc:src/database) - Couche d'abstraction base de données

## Exemple Complet

### Composant avec Architecture Correcte
```typescript
import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
import { useStockPageData } from '../hooks/useOptimizedSelectors';
import { updateItemStatus } from '../store/itemsThunks';

const ItemList = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { items, isLoading } = useStockPageData({});

  const handleMarkAsSold = useCallback(async (itemId: number) => {
    try {
      await dispatch(updateItemStatus({ 
        itemId, 
        status: 'sold',
        soldDate: new Date().toISOString()
      })).unwrap();
    } catch (error) {
      console.error('Erreur:', error);
    }
  }, [dispatch]);

  if (isLoading) return <Loading />;

  return (
    <div>
      {items.map(item => (
        <ItemCard 
          key={item.id} 
          item={item} 
          onMarkAsSold={() => handleMarkAsSold(item.id)}
        />
      ))}
    </div>
  );
};
```

## Résumé

1. **Utiliser hooks optimisés** : `useStockPageData`, `useCategoriesOptimized`, `useContainersOptimized`
2. **Utiliser Redux thunks** pour toutes les mutations
3. **Typer dispatch** avec `AppDispatch`
4. **Éviter database direct** dans composants/hooks
5. **Suivre pattern .unwrap()** pour gestion d'erreurs

---
*From: @.cursor/rules/optimizations-hooks.mdc*
---
# Hooks Redux Optimisés - Règles d'Utilisation

## Sélecteurs Mémoïsés Obligatoires

### Utilisation des Hooks Optimisés

**TOUJOURS utiliser les hooks optimisés** au lieu des hooks Redux basiques :

```typescript
// ✅ CORRECT - Utiliser les hooks optimisés
import { 
  useStockPageData, 
  useFilteredItems,
  useItemStats,
  useAllCategories,
  useAllContainers,
  useContainerPageData  // ⭐ IMPORTANT pour charger TOUS les items
} from '../../src/hooks/useOptimizedSelectors';

// ❌ INTERDIT - Hooks Redux basiques
import { useItems } from '../../src/hooks/useItems';
import { useCategories } from '../../src/hooks/useCategories';
import { useContainers } from '../../src/hooks/useContainers';
```

### ⚠️ **ATTENTION : Chargement Complet des Items**

**PROBLÈME CRITIQUE** : `useItems()` ne charge que les 50 premiers items par défaut !

#### Pour les Statistiques et Calculs Globaux
```typescript
// ✅ CORRECT - Charge TOUS les items (useContainerPageData force le chargement complet)
const { items, categories, containers } = useContainerPageData();
const stats = calculateGlobalStats(items); // Calcul sur TOUS les items

// ❌ INTERDIT - Ne charge que 50 items maximum
const { data: items } = useItems();
const stats = calculateGlobalStats(items); // ❌ Statistiques incomplètes !
```

#### Quand Utiliser Chaque Hook

| Hook | Usage | Limite Items | Cas d'Usage |
|------|-------|--------------|-------------|
| `useStockPageData()` | Liste paginée | 50 items | Pages de stock avec pagination |
| `useFilteredItems()` | Filtrage simple | 50 items | Filtres sur vue paginée |
| `useContainerPageData()` | **Chargement complet** | **TOUS les items** | **Statistiques, calculs globaux** |
| `useGlobalSearch()` | Recherche globale | TOUS les items | Recherche dans tout l'inventaire |

### Référence d'Implémentation
- [src/hooks/useOptimizedSelectors.ts](mdc:src/hooks/useOptimizedSelectors.ts)
- [src/store/selectors.ts](mdc:src/store/selectors.ts)

### Hooks Disponibles par Cas d'Usage

#### Page Stock - Hook Combiné
```typescript
// Pour la page stock complète avec filtres
const { items, categories, containers, isLoading, error, pagination } = useStockPageData(filters);
```

#### Filtrage Simple
```typescript
// Pour filtrer les items uniquement
const items = useFilteredItems({ status: 'available', searchQuery: 'test' });
```

#### Statistiques et Dashboards
```typescript
// Pour les statistiques
const stats = useItemStats();
const { stats, itemsByCategory, itemsByContainer, isLoading } = useDashboardData();
```

#### Relations Entités
```typescript
// Pour les données avec relations populées
const itemsWithRelations = useItemsWithRelations(filters);
```

## Interface ItemFilters

### Structure Obligatoire
```typescript
interface ItemFilters {
  status?: 'all' | 'available' | 'sold';
  categoryId?: number;
  containerId?: number;
  minPrice?: number;
  maxPrice?: number;
  searchQuery?: string;
}
```

### Conversion des Filtres
```typescript
// Conversion des filtres UI vers ItemFilters
const reduxFilters: ItemFilters = useMemo(() => ({
  status: filters.status,
  searchQuery: searchQuery.trim(),
  categoryId: selectedCategoryId,
  containerId: selectedContainerId,
}), [filters, searchQuery, selectedCategoryId, selectedContainerId]);
```

## Patterns d'Optimisation

### Mémoïsation des Filtres
```typescript
// ✅ CORRECT - Mémoïser les filtres complexes
const filters = useMemo(() => ({
  status: selectedStatus,
  searchQuery: searchQuery.trim(),
  categoryId: selectedCategory?.id,
}), [selectedStatus, searchQuery, selectedCategory]);

const items = useFilteredItems(filters);
```

### Éviter les Re-renders
```typescript
// ✅ CORRECT - Hook combiné pour éviter multiples useSelector
const { items, categories, containers, isLoading } = useStockPageData(filters);

// ❌ ÉVITER - Multiples hooks séparés (cause re-renders)
const items = useFilteredItems(filters);
const categories = useAllCategories();
const containers = useAllContainers();
const isLoading = useItemsLoading();
```

## Exemples d'Implémentation

### Page Stock Optimisée
Référence : [app/(tabs)/stock.tsx](mdc:app/(tabs)/stock.tsx)

### Page Statistiques
```typescript
const StatsScreen = () => {
  const { stats, itemsByCategory, isLoading } = useDashboardData();
  
  if (isLoading) return <LoadingSkeleton />;
  
  return (
    <View>
      <StatCard value={stats.total} label="Total Articles" />
      <StatCard value={stats.available} label="Disponibles" />
      <CategoryChart data={itemsByCategory} />
    </View>
  );
};
```

### Recherche avec Filtres
```typescript
const SearchScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number>();
  
  const filteredItems = useSearchFilters(searchQuery, { 
    categoryId: selectedCategory,
    status: 'available' 
  });
  
  return <VirtualizedItemList items={filteredItems} />;
};
```

## Performance Guidelines

### Do's ✅
- Utiliser `useStockPageData` pour les pages complètes
- Mémoïser les objets de filtres avec `useMemo`
- Préférer les hooks combinés aux hooks individuels
- Utiliser `useSearchFilters` pour la recherche avec debouncing

### Don'ts ❌
- Ne pas mélanger hooks optimisés et hooks basiques
- Ne pas créer de nouveaux filtres objets à chaque render
- Ne pas utiliser `useSelector` directement pour les entités principales
- Ne pas dupliquer la logique de filtrage dans les composants

## Migration depuis les Hooks Basiques

### Pattern de Remplacement
```typescript
// Avant
const { data: items, isLoading } = useItems();
const { categories } = useCategories();
const { data: containers } = useContainers();

// Après
const { items, categories, containers, isLoading } = useStockPageData(filters);
```

Cette approche garantit des performances optimales et une synchronisation cohérente des données dans toute l'application.

---
*From: @.cursor/rules/performance-optimization-standards.mdc*
---
# Standards d'Optimisation Performance - Guide Unifié

## Architecture d'Optimisation Complète

Cette règle unifie toutes les optimisations de performance de l'application inventaire.

### Composants Optimisés Obligatoires

#### 1. Sélecteurs Redux Mémoïsés
**Référence** : [.cursor/rules/optimizations-hooks.mdc](mdc:.cursor/rules/optimizations-hooks.mdc)

```typescript
// ✅ TOUJOURS utiliser les hooks optimisés
import { useStockPageData, useFilteredItems } from '../../src/hooks/useOptimizedSelectors';

const Component = () => {
  const { items, categories, containers, isLoading } = useStockPageData(filters);
  return <VirtualizedItemList items={items} />;
};
```

#### 2. StyleFactory pour les Styles
**Référence** : [.cursor/rules/stylefactory-optimization.mdc](mdc:.cursor/rules/stylefactory-optimization.mdc)

```typescript
// ✅ TOUJOURS utiliser StyleFactory
import StyleFactory from '../styles/StyleFactory';

const Component = () => {
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemCard');
  return <View style={styles.container} />;
};
```

#### 3. Listes Virtualisées
**Référence** : [.cursor/rules/virtualized-lists.mdc](mdc:.cursor/rules/virtualized-lists.mdc)

```typescript
// ✅ TOUJOURS utiliser VirtualizedItemList pour > 50 items
import VirtualizedItemList from '../../src/components/VirtualizedItemList';

const Component = () => {
  return (
    <VirtualizedItemList
      items={items}
      categories={categories}
      containers={containers}
      estimatedItemSize={120}
    />
  );
};
```

## Checklist d'Optimisation par Page

### Pages de Liste (Stock, Recherche, Filtres)

#### Obligatoire ✅
1. **Hook optimisé** : `useStockPageData()` ou `useFilteredItems()`
2. **Liste virtualisée** : `VirtualizedItemList` au lieu de `FlatList`
3. **StyleFactory** : Styles mis en cache
4. **Callbacks mémoïsés** : `useCallback` pour tous les handlers
5. **Filtres mémoïsés** : `useMemo` pour les objets de filtres

#### Exemple Type - Page Stock
```typescript
const StockScreen = () => {
  // 1. Filtres mémoïsés
  const filters = useMemo(() => ({
    status: selectedStatus,
    searchQuery: searchQuery.trim(),
  }), [selectedStatus, searchQuery]);

  // 2. Hook optimisé
  const { items, categories, containers, isLoading } = useStockPageData(filters);

  // 3. Styles mis en cache
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemList');

  // 4. Callbacks mémoïsés
  const handleItemPress = useCallback((item: Item) => {
    router.push(`/item/${item.id}/info`);
  }, [router]);

  const handleMarkAsSold = useCallback((item: Item) => {
    dispatch(updateItemStatus({ itemId: item.id, status: 'sold' }));
  }, [dispatch]);

  // 5. Liste virtualisée
  return (
    <View style={styles.container}>
      <VirtualizedItemList
        items={items}
        categories={categories}
        containers={containers}
        onItemPress={handleItemPress}
        onMarkAsSold={handleMarkAsSold}
        estimatedItemSize={120}
      />
    </View>
  );
};
```

### Pages de Formulaire (Add, Edit)

#### Obligatoire ✅
1. **StyleFactory** pour formulaires : `'ItemForm'`
2. **Validation mémoïsée** : `useMemo` pour les règles
3. **Callbacks stables** : `useCallback` pour submit/cancel
4. **État local optimisé** : `useRef` pour valeurs stables

#### Exemple Type - Formulaire
```typescript
const ItemForm = () => {
  // 1. Styles mis en cache
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemForm');

  // 2. Validation mémoïsée
  const validationRules = useMemo(() => ({
    name: { required: true, minLength: 2 },
    price: { required: true, type: 'number' }
  }), []);

  // 3. Callbacks stables
  const handleSubmit = useCallback(async (data: ItemFormData) => {
    await dispatch(createItem(data));
    router.back();
  }, [dispatch, router]);

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <ScrollView style={styles.container}>
      <FormFields styles={styles} validation={validationRules} />
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.buttonSecondary} onPress={handleCancel}>
          <Text style={styles.buttonTextSecondary}>Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleSubmit}>
          <Text style={styles.buttonText}>Sauvegarder</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
```

### Pages de Statistiques (Dashboard, Analytics)

#### Obligatoire ✅
1. **Hook statistiques** : `useDashboardData()`
2. **StyleFactory** : `'Stats'` pour graphiques
3. **Mémoïsation données** : `useMemo` pour calculs
4. **Composants charts mémoïsés** : `React.memo`

#### Exemple Type - Dashboard
```typescript
const StatsScreen = () => {
  // 1. Hook optimisé pour stats
  const { stats, itemsByCategory, itemsByContainer, isLoading } = useDashboardData();

  // 2. Styles mis en cache
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'Stats');

  // 3. Calculs mémoïsés
  const chartData = useMemo(() => ({
    categories: itemsByCategory.map(cat => ({
      name: cat.category.name,
      value: cat.count,
      color: generateColor(cat.category.id)
    }))
  }), [itemsByCategory]);

  if (isLoading) return <LoadingSkeleton />;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{stats.total}</Text>
        <Text style={styles.statLabel}>Total Articles</Text>
      </View>
      <MemoizedChart data={chartData} />
    </ScrollView>
  );
};

// 4. Composant chart mémoïsé
const MemoizedChart = React.memo(ChartComponent);
```

## Patterns Anti-Performance à Éviter

### ❌ Violations Critiques

#### 1. Hooks Redux Basiques (INTERDIT)
```typescript
// ❌ INTERDIT - Performance dégradée
const { data: items } = useItems();
const { categories } = useCategories();
const { data: containers } = useContainers();

// ✅ CORRECT - Hook optimisé
const { items, categories, containers } = useStockPageData(filters);
```

#### 2. StyleSheet Direct (INTERDIT)
```typescript
// ❌ INTERDIT - Pas de cache
const Component = () => {
  const styles = StyleSheet.create({
    container: { backgroundColor: theme.background }
  });
  // Recréé à chaque render !
};

// ✅ CORRECT - StyleFactory avec cache
const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemCard');
```

#### 3. FlatList pour Grandes Listes (INTERDIT)
```typescript
// ❌ INTERDIT - Performance dégradée pour > 50 items
<FlatList data={largeList} renderItem={renderItem} />

// ✅ CORRECT - Virtualisation
<VirtualizedItemList items={largeList} />
```

#### 4. Callbacks Non-Mémoïsés (CRITIQUE)
```typescript
// ❌ CRITIQUE - Cause re-renders en cascade
<VirtualizedItemList
  onItemPress={(item) => handlePress(item)}  // Nouvelle fonction à chaque render
/>

// ✅ CORRECT - Callback stable
const handleItemPress = useCallback((item) => handlePress(item), []);
<VirtualizedItemList onItemPress={handleItemPress} />
```

## Migration Guidelines

### Étapes de Migration d'une Page

#### 1. Audit Performance
```typescript
// Vérifier ces éléments dans l'ordre :
// 1. Hooks Redux → useStockPageData()
// 2. Styles → StyleFactory
// 3. Listes → VirtualizedItemList
// 4. Callbacks → useCallback
// 5. Mémoïsation → useMemo
```

#### 2. Remplacements Prioritaires
```typescript
// Ordre de priorité pour maximiser l'impact performance :
// 1. Listes longues → VirtualizedItemList (gain immédiat)
// 2. Hooks Redux → Sélecteurs optimisés (évite re-renders)
// 3. Styles → StyleFactory (cache, responsive)
// 4. Callbacks → Mémoïsation (stabilité)
```

#### 3. Validation Post-Migration
```typescript
// Vérifier ces métriques après migration :
// 1. Temps de rendu initial < 500ms
// 2. Scroll fluide sans frame drops
// 3. Mémoire stable (pas de fuites)
// 4. Re-renders minimaux (React DevTools)
```

## Références d'Implémentation

### Pages Modèles Optimisées
- **Stock** : [app/(tabs)/stock.tsx](mdc:app/(tabs)/stock.tsx) - Hooks + StyleFactory + VirtualizedList
- **Sélecteurs** : [src/store/selectors.ts](mdc:src/store/selectors.ts) - Mémoïsation Redux
- **Hooks** : [src/hooks/useOptimizedSelectors.ts](mdc:src/hooks/useOptimizedSelectors.ts) - Combinaison optimisée
- **Styles** : [src/styles/StyleFactory.ts](mdc:src/styles/StyleFactory.ts) - Cache intelligent
- **Listes** : [src/components/VirtualizedItemList.tsx](mdc:src/components/VirtualizedItemList.tsx) - Virtualisation

### Métriques de Performance Cibles

#### Objectifs Quantifiés
- **Temps de chargement initial** : < 1 seconde
- **Scroll fluide** : 60 FPS constant
- **Mémoire** : < 100MB pour 1000+ items
- **Re-renders** : < 5 par interaction utilisateur
- **Bundle size** : Impact < 50KB par optimisation

#### Outils de Mesure
```typescript
// React DevTools Profiler
// Flipper React Native Performance
// Metro Bundle Analyzer
// Hermes Memory Profiler (mobile)
```

Cette architecture d'optimisation garantit des performances excellentes et une expérience utilisateur fluide sur toutes les plateformes.

---
*From: @.cursor/rules/virtualized-lists.mdc*
---
# Listes Virtualisées - Règles d'Utilisation FlashList

## Virtualisation Obligatoire pour les Grandes Listes

### Utilisation de VirtualizedItemList

**TOUJOURS utiliser VirtualizedItemList** pour les listes d'articles :

```typescript
// ✅ CORRECT - Utiliser VirtualizedItemList
import VirtualizedItemList from '../../src/components/VirtualizedItemList';

const Component = () => {
  return (
    <VirtualizedItemList
      items={items}
      categories={categories}
      containers={containers}
      onItemPress={handleItemPress}
      onMarkAsSold={handleMarkAsSold}
      onMarkAsAvailable={handleMarkAsAvailable}
      estimatedItemSize={120}
    />
  );
};

// ❌ INTERDIT - FlatList ou ItemList basique pour > 50 items
import { FlatList } from 'react-native';
import ItemList from '../../src/components/ItemList';
```

### Référence d'Implémentation
- [src/components/VirtualizedItemList.tsx](mdc:src/components/VirtualizedItemList.tsx)

## Props et Configuration

### Props Obligatoires
```typescript
interface VirtualizedItemListProps {
  items: Item[];                    // Liste des articles
  categories: Category[];           // Catégories pour les relations
  containers: Container[];          // Containers pour les relations
  onItemPress?: (item: Item) => void;
  onMarkAsSold?: (item: Item) => void;
  onMarkAsAvailable?: (item: Item) => void;
}
```

### Props d'Optimisation
```typescript
interface OptimizationProps {
  estimatedItemSize?: number;       // Défaut: 120px
  isLoading?: boolean;             // État de chargement
  onEndReached?: () => void;       // Pagination
  isLoadingMore?: boolean;         // Chargement pagination
  refreshing?: boolean;            // Pull-to-refresh
  onRefresh?: () => void;          // Callback refresh
}
```

### Configuration Recommandée
```typescript
<VirtualizedItemList
  items={items}
  categories={categories}
  containers={containers}
  estimatedItemSize={120}          // Hauteur estimée d'un item
  onEndReached={handleLoadMore}    // Pagination
  onRefresh={handleRefresh}        // Pull-to-refresh
  refreshing={isRefreshing}
  isLoadingMore={isLoadingMore}
  // Event handlers
  onItemPress={handleItemPress}
  onMarkAsSold={handleMarkAsSold}
  onMarkAsAvailable={handleMarkAsAvailable}
/>
```

## Optimisations de Performance

### Mémoïsation des Callbacks
```typescript
// ✅ CORRECT - Callbacks mémoïsés
const Component = () => {
  const handleItemPress = useCallback((item: Item) => {
    router.push(`/item/${item.id}/info`);
  }, [router]);

  const handleMarkAsSold = useCallback((item: Item) => {
    dispatch(updateItemStatus({ itemId: item.id, status: 'sold' }));
  }, [dispatch]);

  const handleMarkAsAvailable = useCallback((item: Item) => {
    dispatch(updateItemStatus({ itemId: item.id, status: 'available' }));
  }, [dispatch]);

  return (
    <VirtualizedItemList
      items={items}
      onItemPress={handleItemPress}
      onMarkAsSold={handleMarkAsSold}
      onMarkAsAvailable={handleMarkAsAvailable}
    />
  );
};
```

### Key Extractor Optimisé
La liste utilise automatiquement un key extractor optimisé :
```typescript
// Généré automatiquement dans VirtualizedItemList
const keyExtractor = (item: Item, index: number) => {
  return `${item.id}-${item.updatedAt}-${index}`;
};
```

### Comparaison Intelligente
Le composant utilise `React.memo` avec comparaison optimisée :
```typescript
// Implémenté dans VirtualizedItemComponent
const areEqual = (prevProps, nextProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.updatedAt === nextProps.item.updatedAt &&
    prevProps.item.status === nextProps.item.status &&
    prevProps.item.photo_storage_url === nextProps.item.photo_storage_url
  );
};
```

## Gestion des États

### Loading States
```typescript
const Component = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await dispatch(fetchItems({ page: 0, limit: 50 }));
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch]);

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    try {
      await dispatch(fetchItems({ page: currentPage + 1, limit: 50 }));
    } finally {
      setIsLoadingMore(false);
    }
  }, [dispatch, isLoadingMore, hasMore, currentPage]);

  return (
    <VirtualizedItemList
      items={items}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      onEndReached={handleLoadMore}
      isLoadingMore={isLoadingMore}
    />
  );
};
```

### Error Handling
```typescript
// La liste inclut automatiquement un ErrorBoundary
<VirtualizedItemList
  items={items}
  // En cas d'erreur, affiche automatiquement un fallback
/>
```

## Cas d'Usage Spécifiques

### Page Stock Principal
Référence : [app/(tabs)/stock.tsx](mdc:app/(tabs)/stock.tsx)

### Liste avec Filtres
```typescript
const FilteredList = () => {
  const [filters, setFilters] = useState<ItemFilters>({ status: 'available' });
  const filteredItems = useFilteredItems(filters);

  return (
    <>
      <FilterBar filters={filters} onFiltersChange={setFilters} />
      <VirtualizedItemList
        items={filteredItems}
        categories={categories}
        containers={containers}
        estimatedItemSize={120}
      />
    </>
  );
};
```

### Liste avec Recherche
```typescript
const SearchableList = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const searchResults = useSearchFilters(searchQuery);

  return (
    <>
      <SearchBox query={searchQuery} onQueryChange={setSearchQuery} />
      <VirtualizedItemList
        items={searchResults}
        categories={categories}
        containers={containers}
        estimatedItemSize={120}
      />
    </>
  );
};
```

## Performance Guidelines

### Do's ✅

#### Estimation de Taille Précise
```typescript
// ✅ CORRECT - Estimer la hauteur réelle des items
<VirtualizedItemList 
  estimatedItemSize={120}  // Hauteur mesurée d'un ItemCard
/>
```

#### Données Stables
```typescript
// ✅ CORRECT - Mémoïser les données de liste
const memoizedItems = useMemo(() => items, [items]);

<VirtualizedItemList items={memoizedItems} />
```

#### Pull-to-Refresh
```typescript
// ✅ CORRECT - Implémenter le refresh
<VirtualizedItemList
  items={items}
  refreshing={isRefreshing}
  onRefresh={handleRefresh}
/>
```

### Don'ts ❌

#### Éviter FlatList pour Grandes Listes
```typescript
// ❌ ÉVITER - FlatList pour > 50 items
<FlatList 
  data={largeItemsList}  // Performance dégradée
  renderItem={renderItem}
/>

// ✅ UTILISER - VirtualizedItemList
<VirtualizedItemList items={largeItemsList} />
```

#### Éviter les Callbacks Non-Mémoïsés
```typescript
// ❌ ÉVITER - Callbacks recréés à chaque render
<VirtualizedItemList
  onItemPress={(item) => handlePress(item)}  // Nouvelle fonction à chaque render
/>

// ✅ CORRECT - Callback mémoïsé
const handleItemPress = useCallback((item) => handlePress(item), []);
<VirtualizedItemList onItemPress={handleItemPress} />
```

#### Éviter la Mutation de Props
```typescript
// ❌ ÉVITER - Modifier les props directement
const modifiedItems = items.map(item => ({ ...item, modified: true }));

// ✅ CORRECT - Utiliser les sélecteurs mémoïsés
const processedItems = useFilteredItems(filters);
```

## Migration depuis FlatList

### Pattern de Remplacement
```typescript
// Avant - FlatList
<FlatList
  data={items}
  renderItem={({ item }) => <ItemCard item={item} />}
  keyExtractor={(item) => item.id.toString()}
  onEndReached={handleLoadMore}
  refreshing={refreshing}
  onRefresh={handleRefresh}
/>

// Après - VirtualizedItemList
<VirtualizedItemList
  items={items}
  categories={categories}
  containers={containers}
  onEndReached={handleLoadMore}
  refreshing={refreshing}
  onRefresh={handleRefresh}
  estimatedItemSize={120}
/>
```

## Performance Metrics

### Gains Attendus
- **Mémoire** : -80% pour listes > 100 items
- **Temps de rendu** : -60% pour le scroll rapide
- **JS Thread** : -50% de blocking pendant le scroll
- **Frame drops** : Quasi éliminés sur les listes longues

### Monitoring
```typescript
// Pour mesurer les performances (dev uniquement)
import { performance } from 'react-native-performance';

const startTime = performance.now();
// Render de la liste
const endTime = performance.now();
console.log(`Render time: ${endTime - startTime}ms`);
```

Cette virtualisation garantit des performances optimales même avec des milliers d'articles.

---
*From: @.cursor/rules/stylefactory-optimization.mdc*
---
# StyleFactory Optimisé - Règles d'Utilisation

## Cache Intelligent des Styles

### Utilisation Obligatoire du StyleFactory

**TOUJOURS utiliser StyleFactory** au lieu de StyleSheet direct :

```typescript
// ✅ CORRECT - Utiliser StyleFactory
import StyleFactory from '../styles/StyleFactory';
import { useAppTheme } from '../contexts/ThemeContext';

const Component = () => {
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemCard');
  
  return <View style={styles.container} />;
};

// ❌ INTERDIT - StyleSheet direct dans les composants
const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.background, // Pas de cache, recréé à chaque render
  }
});
```

### Référence d'Implémentation
- [src/styles/StyleFactory.ts](mdc:src/styles/StyleFactory.ts)

## Composants Supportés

### Noms de Composants Disponibles
```typescript
type ComponentName = 
  | 'ItemCard'      // Cartes d'articles
  | 'ItemList'      // Listes d'articles  
  | 'ItemForm'      // Formulaires d'articles
  | 'CategoryCard'  // Cartes de catégories
  | 'ContainerCard' // Cartes de containers
  | 'Scanner'       // Interface scanner
  | 'Stats'         // Statistiques et graphiques
  | 'FilterBar'     // Barres de filtres
  | 'Common';       // Styles communs réutilisables
```

### Pattern d'Utilisation Standard
```typescript
const Component: React.FC = () => {
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemCard');
  
  // Utiliser styles.container, styles.title, etc.
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Titre</Text>
    </View>
  );
};
```

## Variantes de Styles

### Support des Variants
```typescript
// Style normal
const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemCard');

// Style compact
const compactStyles = StyleFactory.getThemedStyles(activeTheme, 'ItemCard', 'compact');
```

### Styles Communs Réutilisables
```typescript
// Pour accéder aux styles communs
const commonStyles = StyleFactory.getThemedStyles(activeTheme, 'Common');

// Utilisation dans un composant custom
const customStyles = StyleSheet.create({
  customContainer: {
    ...commonStyles.container,
    padding: 20, // Override ou ajout
  },
  customButton: {
    ...commonStyles.button,
    backgroundColor: activeTheme.secondary,
  }
});
```

## Gestion du Cache

### Invalidation Automatique
Le cache est automatiquement invalidé lors des changements de thème via le ThemeContext.

Référence : [src/contexts/ThemeContext.tsx](mdc:src/contexts/ThemeContext.tsx)

### Invalidation Manuelle (Cas Exceptionnel)
```typescript
// Seulement si nécessaire (très rare)
StyleFactory.invalidateCache();
```

## Styles Platform-Specific

### Web vs Mobile Optimization
```typescript
// Le StyleFactory gère automatiquement les différences platform
const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemCard');
// styles.shadow contiendra boxShadow pour web, elevation pour mobile
```

### Structure des Styles Générés
```typescript
// Exemple de styles générés pour ItemCard
interface ItemCardStyles {
  container: ViewStyle;
  imageContainer: ViewStyle;
  image: ImageStyle;
  contentContainer: ViewStyle;
  titleRow: ViewStyle;
  name: TextStyle;
  price: TextStyle;
  description: TextStyle;
  statusContainer: ViewStyle;
  statusBadge: ViewStyle;
  statusText: TextStyle;
  actionButton: ViewStyle;
}
```

## Bonnes Pratiques

### Do's ✅

#### Utilisation Cohérente
```typescript
// ✅ CORRECT - Une seule récupération de styles par composant
const Component = () => {
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemForm');
  
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Label</Text>
      <TextInput style={styles.input} />
      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Action</Text>
      </TouchableOpacity>
    </View>
  );
};
```

#### Extension de Styles
```typescript
// ✅ CORRECT - Étendre les styles du factory
const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemCard');
return (
  <View style={[styles.container, { marginTop: 10 }]}>
    <Text style={[styles.title, { fontSize: 18 }]}>Titre Custom</Text>
  </View>
);
```

### Don'ts ❌

#### Éviter StyleSheet Direct
```typescript
// ❌ ÉVITER - StyleSheet direct (pas de cache)
const Component = () => {
  const { activeTheme } = useAppTheme();
  const styles = StyleSheet.create({
    container: { backgroundColor: activeTheme.background }
  });
  // Recréé à chaque render !
};
```

#### Éviter la Recréation
```typescript
// ❌ ÉVITER - Recréation des styles
const Component = () => {
  const { activeTheme } = useAppTheme();
  
  return items.map(item => {
    const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemCard'); // ❌ Dans une boucle
    return <ItemCard key={item.id} styles={styles} />;
  });
};

// ✅ CORRECT - Une seule récupération
const Component = () => {
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemCard');
  
  return items.map(item => (
    <ItemCard key={item.id} styles={styles} />
  ));
};
```

## Exemples d'Implémentation

### Page Stock avec StyleFactory
Référence : [app/(tabs)/stock.tsx](mdc:app/(tabs)/stock.tsx)

### Composant ItemCard Optimisé
```typescript
const ItemCard: React.FC<ItemCardProps> = ({ item }) => {
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemCard');
  
  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        <Image source={{ uri: item.photo }} style={styles.image} />
      </View>
      <View style={styles.contentContainer}>
        <View style={styles.titleRow}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.price}>{item.price}€</Text>
        </View>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    </View>
  );
};
```

### Formulaire avec StyleFactory
```typescript
const ItemForm: React.FC = () => {
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemForm');
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nom</Text>
          <TextInput style={styles.input} />
        </View>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.buttonSecondary}>
          <Text style={styles.buttonTextSecondary}>Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Sauvegarder</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
```

## Performance Impact

### Gains Attendus
- **Cache automatique** : -50% de temps de génération des styles
- **Réutilisation** : Styles identiques partagés entre composants
- **Optimisation plateforme** : Styles adaptés automatiquement (web/mobile)
- **Memory efficiency** : Évite la duplication des styles similaires

### Monitoring des Performances
```typescript
// Pour débugger la performance du cache (dev uniquement)
console.log('Cache size:', StyleFactory.cache.size);
```

Cette approche garantit des styles optimisés, mis en cache et cohérents dans toute l'application.

---
*From: @.cursor/rules/dark-mode-theme.mdc*
---
# Gestion du Mode Sombre et Thème

## ThemeContext Principal

### Référence d'Implémentation
- [src/contexts/ThemeContext.tsx](mdc:src/contexts/ThemeContext.tsx)

### Utilisation Obligatoire du Hook useAppTheme
**TOUJOURS utiliser useAppTheme pour accéder au thème actif**

```typescript
// ✅ CORRECT - Utiliser useAppTheme
import { useAppTheme } from '../contexts/ThemeContext';

const Component = () => {
  const { activeTheme, themeMode, setThemeMode } = useAppTheme();
  
  return (
    <View style={{ backgroundColor: activeTheme.background }}>
      <Text style={{ color: activeTheme.text.primary }}>
        Contenu
      </Text>
    </View>
  );
};
```

```typescript
// ❌ INTERDIT - Ne pas utiliser de couleurs hardcodées
<View style={{ backgroundColor: '#FFFFFF' }}>
<Text style={{ color: '#000000' }}>Contenu</Text>
```

## Types de Thème

### ThemeMode
```typescript
export type ThemeMode = 'light' | 'dark' | 'system';
```

### AppThemeType Structure
```typescript
export type AppThemeType = {
  // Couleurs principales
  primary: string;
  primaryLight: string;
  secondary: string;
  
  // Arrière-plans
  background: string;
  backgroundSecondary: string;
  surface: string;
  card: string;
  
  // États
  error: string;
  success: string;
  successLight: string;
  warning: string;
  
  // Texte
  text: {
    primary: string;
    secondary: string;
    disabled: string;
    inverse: string;
    onPrimary: string;
  };
  
  // Bordures et autres
  border: string;
  backdrop: string;
  
  // Danger
  danger: {
    main: string;
    light: string;
    text: string;
    background: string;
  };
  
  // Design tokens
  spacing: any;
  typography: any;
  borderRadius: any;
  shadows: any;
};
```

## Couleurs par Mode

### Mode Clair (Light)
```typescript
const lightTheme = {
  primary: '#007AFF',        // Bleu
  background: '#F2F2F7',     // Gris très clair
  surface: '#FFFFFF',        // Blanc
  text: {
    primary: '#000000',      // Noir
    secondary: '#666666',    // Gris
  },
  // ... autres couleurs
};
```

### Mode Sombre (Dark)
```typescript
const darkTheme = {
  primary: '#0A84FF',        // Bleu plus vif
  background: '#000000',     // Noir
  surface: '#1C1C1E',        // Gris très sombre
  text: {
    primary: '#FFFFFF',      // Blanc
    secondary: '#A0A0A0',    // Gris clair
  },
  // ... autres couleurs
};
```

## Utilisation dans les Composants

### Pattern de Base
```typescript
import { useAppTheme } from '../contexts/ThemeContext';

const Component = () => {
  const { activeTheme } = useAppTheme();
  
  return (
    <View style={[styles.container, { backgroundColor: activeTheme.background }]}>
      <Text style={[styles.title, { color: activeTheme.text.primary }]}>
        Titre
      </Text>
      <Text style={[styles.subtitle, { color: activeTheme.text.secondary }]}>
        Sous-titre
      </Text>
    </View>
  );
};
```

### Styles Dynamiques avec StyleSheet
```typescript
const getThemedStyles = (theme: AppThemeType) => StyleSheet.create({
  container: {
    backgroundColor: theme.background,
    borderColor: theme.border,
  },
  card: {
    backgroundColor: theme.surface,
    shadowColor: theme.text.primary,
  },
  primaryButton: {
    backgroundColor: theme.primary,
  },
  primaryButtonText: {
    color: theme.text.onPrimary,
  },
});

// Utilisation
const Component = () => {
  const { activeTheme } = useAppTheme();
  const styles = getThemedStyles(activeTheme);
  
  return <View style={styles.container} />;
};
```

## Gestion des Modes de Thème

### Changement de Mode
```typescript
const ThemeSelector = () => {
  const { themeMode, setThemeMode } = useAppTheme();
  
  return (
    <View>
      {(['light', 'dark', 'system'] as ThemeMode[]).map((mode) => (
        <TouchableOpacity
          key={mode}
          onPress={() => setThemeMode(mode)}
          style={[
            styles.themeButton,
            { backgroundColor: themeMode === mode ? activeTheme.primary : activeTheme.surface }
          ]}
        >
          <Text style={{ color: themeMode === mode ? activeTheme.text.onPrimary : activeTheme.text.primary }}>
            {mode === 'light' ? 'Clair' : mode === 'dark' ? 'Sombre' : 'Système'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};
```

### Détection du Mode Système
```typescript
import { useColorScheme } from 'react-native';

const Component = () => {
  const { themeMode, activeTheme } = useAppTheme();
  const systemScheme = useColorScheme();
  
  // Affichage du mode actuel
  const currentThemeDisplay = useMemo(() => {
    switch (themeMode) {
      case 'system':
        return `Système (${systemScheme === 'dark' ? 'Sombre' : 'Clair'})`;
      case 'dark':
        return 'Sombre';
      case 'light':
        return 'Clair';
      default:
        return 'Clair';
    }
  }, [themeMode, systemScheme]);
  
  return (
    <Text style={{ color: activeTheme.text.primary }}>
      Mode actuel: {currentThemeDisplay}
    </Text>
  );
};
```

## Couleurs Sémantiques

### États et Actions
```typescript
// Succès
backgroundColor: activeTheme.success
color: activeTheme.success

// Erreur
backgroundColor: activeTheme.error
color: activeTheme.error

// Avertissement
backgroundColor: activeTheme.warning
color: activeTheme.warning

// Danger
backgroundColor: activeTheme.danger.main
color: activeTheme.danger.text
```

### Hiérarchie de Texte
```typescript
// Titre principal
color: activeTheme.text.primary

// Texte secondaire
color: activeTheme.text.secondary

// Texte désactivé
color: activeTheme.text.disabled

// Texte sur fond coloré
color: activeTheme.text.inverse
color: activeTheme.text.onPrimary
```

### Surfaces et Conteneurs
```typescript
// Arrière-plan principal
backgroundColor: activeTheme.background

// Arrière-plan secondaire
backgroundColor: activeTheme.backgroundSecondary

// Cartes et modales
backgroundColor: activeTheme.surface

// Bordures
borderColor: activeTheme.border

// Overlay/backdrop
backgroundColor: activeTheme.backdrop
```

## Bonnes Pratiques

### Éviter les Couleurs Hardcodées
```typescript
// ✅ CORRECT
<View style={{ backgroundColor: activeTheme.surface }}>

// ❌ INTERDIT
<View style={{ backgroundColor: '#FFFFFF' }}>
```

### Utiliser useMemo pour les Styles Complexes
```typescript
const styles = useMemo(() => StyleSheet.create({
  container: {
    backgroundColor: activeTheme.background,
    borderColor: activeTheme.border,
  },
}), [activeTheme]);
```

### Gestion des Transitions
```typescript
// Les changements de thème sont automatiques
// Pas besoin de gestion manuelle des transitions
```

## Persistance du Thème

### Sauvegarde Automatique
- Le mode de thème est automatiquement sauvegardé dans AsyncStorage
- Restauration automatique au démarrage de l'application
- Synchronisation avec les changements système (mode 'system')

### Exemple d'Implémentation
Référence : [app/(stack)/settings.tsx](mdc:app/(stack)/settings.tsx)

## Compatibilité Plateforme

### iOS
- Support natif du mode sombre
- Transitions automatiques
- Respect des préférences système

### Android
- Support du mode sombre Android 10+
- Fallback gracieux pour versions antérieures
- Thème adaptatif

### Web
- Support des media queries CSS
- Respect des préférences navigateur
- Performance optimisée

Cette approche garantit une expérience utilisateur cohérente et accessible sur toutes les plateformes avec un support complet du mode sombre.

---
*From: @.cursor/rules/icon-usage.mdc*
---
# Utilisation du Composant Icon Personnalisé

## Composant Icon Principal

### Référence d'Implémentation
- [src/components/Icon.tsx](mdc:src/components/Icon.tsx)

### Utilisation Obligatoire
**TOUJOURS utiliser le composant Icon personnalisé au lieu de @expo/vector-icons**

```typescript
// ✅ CORRECT - Utiliser le composant Icon personnalisé
import { Icon } from '../../src/components';
// ou
import Icon from '../../src/components/Icon';

<Icon name="arrow_back" size={24} color={activeTheme.primary} />
<Icon name="inventory" size={48} color={activeTheme.text.secondary} />
<Icon name="category" size={24} color={activeTheme.primary} />
```

```typescript
// ❌ INTERDIT - Ne plus utiliser @expo/vector-icons directement
import { MaterialIcons } from '@expo/vector-icons';
<MaterialIcons name="inventory" size={48} color={activeTheme.text.secondary} />
```

## Interface du Composant Icon

### Props Disponibles
```typescript
interface IconProps {
  name: string;                    // Nom de l'icône Material Icons
  size?: number;                   // Taille (défaut: 24)
  color?: string;                  // Couleur (défaut: '#000')
  variant?: 'filled' | 'outlined' | 'round' | 'sharp' | 'two-tone'; // Variante (défaut: 'filled')
  style?: any;                     // Styles additionnels
}
```

### Exemples d'Utilisation
```typescript
// Icône basique
<Icon name="home" />

// Icône avec taille et couleur
<Icon name="search" size={20} color={activeTheme.primary} />

// Icône avec variante
<Icon name="favorite" variant="outlined" size={24} color="#FF0000" />

// Icône avec styles personnalisés
<Icon 
  name="settings" 
  size={28} 
  color={activeTheme.text.primary}
  style={{ marginRight: 8 }}
/>
```

## Compatibilité Plateforme

### Web
- Utilise les classes CSS Material Icons
- Support complet des variantes (`material-icons`, `material-icons-outlined`, etc.)
- Rendu via élément `<span>` avec classes CSS

### Mobile (iOS/Android)
- Utilise `@expo/vector-icons/MaterialIcons`
- Rendu natif optimisé
- Fallback automatique pour les variantes

## Icônes Couramment Utilisées

### Navigation
```typescript
<Icon name="arrow_back" />        // Retour
<Icon name="arrow_back_ios" />    // Retour iOS
<Icon name="chevron_right" />     // Flèche droite
<Icon name="close" />             // Fermer
```

### Actions
```typescript
<Icon name="add" />               // Ajouter
<Icon name="edit" />              // Éditer
<Icon name="delete" />            // Supprimer
<Icon name="search" />            // Rechercher
<Icon name="filter_list" />       // Filtrer
```

### Inventaire
```typescript
<Icon name="inventory" />         // Inventaire
<Icon name="category" />          // Catégorie
<Icon name="inbox" />             // Container
<Icon name="qr_code" />           // QR Code
<Icon name="label" />             // Étiquette
```

### Statuts
```typescript
<Icon name="check_circle" />      // Succès
<Icon name="error" />             // Erreur
<Icon name="warning" />           // Avertissement
<Icon name="info" />              // Information
```

## Intégration avec le Thème

### Utilisation avec ThemeContext
```typescript
import { useAppTheme } from '../contexts/ThemeContext';

const Component = () => {
  const { activeTheme } = useAppTheme();
  
  return (
    <Icon 
      name="settings" 
      size={24} 
      color={activeTheme.primary}
    />
  );
};
```

### Couleurs Thématiques Recommandées
```typescript
// Icônes principales
color={activeTheme.primary}

// Icônes secondaires
color={activeTheme.text.secondary}

// Icônes de texte
color={activeTheme.text.primary}

// Icônes de danger
color={activeTheme.danger.main}

// Icônes de succès
color={activeTheme.success}
```

## Migration depuis @expo/vector-icons

### Pattern de Remplacement
```typescript
// Avant
import { MaterialIcons } from '@expo/vector-icons';
<MaterialIcons name="home" size={24} color="#007AFF" />

// Après
import { Icon } from '../../src/components';
<Icon name="home" size={24} color="#007AFF" />
```

### Recherche et Remplacement
```bash
# Rechercher les utilisations de MaterialIcons
grep -r "MaterialIcons" --include="*.tsx" --include="*.ts" .

# Rechercher les imports @expo/vector-icons
grep -r "@expo/vector-icons" --include="*.tsx" --include="*.ts" .
```

## Avantages du Composant Icon

### Performance Web
- Utilise les polices Material Icons natives
- Pas de bundle JavaScript supplémentaire
- Rendu CSS optimisé

### Consistance
- Interface unifiée sur toutes les plateformes
- Gestion automatique des variantes
- Intégration native avec le système de thème

### Maintenance
- Point d'entrée unique pour toutes les icônes
- Facilite les changements globaux
- Type safety avec TypeScript

Cette approche garantit une utilisation cohérente et performante des icônes dans toute l'application.

---
*From: @.cursor/rules/qrcode-generator-rules.mdc*
---
# Générateur QR Code - Règles d'Utilisation Obligatoires

## Utilisation Obligatoire du QRCodeGenerator

### Générateur Centralisé SEULEMENT

**TOUJOURS utiliser `src/utils/qrCodeGenerator.ts`** pour générer des QR codes :

```typescript
// ✅ CORRECT - Utiliser le générateur centralisé
import { generateUniqueContainerQRCode, generateUniqueItemQRCode } from '../utils/qrCodeGenerator';

// Pour containers
const qrCode = await generateUniqueContainerQRCode(); // Format: CONT_XXXX

// Pour articles
const qrCode = await generateUniqueItemQRCode(); // Format: ART_XXXX
```

```typescript
// ❌ INTERDIT - Génération manuelle
const qrCode = `CONTAINER-${id}`;
const qrCode = `ITEM-${Date.now()}`;
const qrCode = generateId('CONTAINER');
const qrCode = Math.random().toString();
```

### Référence d'Implémentation
- [src/utils/qrCodeGenerator.ts](mdc:src/utils/qrCodeGenerator.ts)

## Fonctions Disponibles

### Fonctions Recommandées ✅

#### Avec Vérification d'Unicité (OBLIGATOIRE)
```typescript
// Pour containers
export const generateUniqueContainerQRCode = async (): Promise<string>
// Retourne: "CONT_ABC1", "CONT_XY42", etc.

// Pour articles  
export const generateUniqueItemQRCode = async (): Promise<string>
// Retourne: "ART_DEF2", "ART_ZW89", etc.
```

### Fonctions Dépréciées ⚠️

#### Sans Vérification d'Unicité (ÉVITER)
```typescript
// ⚠️ DÉPRÉCIÉ - Pas de vérification d'unicité
export const generateContainerQRCode = (): string
export const generateItemQRCode = (): string
```

## Format des QR Codes

### Spécifications Techniques
- **Containers** : `CONT_XXXX` (CONT + underscore + 4 caractères alphanumériques)
- **Articles** : `ART_XXXX` (ART + underscore + 4 caractères alphanumériques)
- **Caractères autorisés** : A-Z et 0-9 (majuscules uniquement)
- **Longueur totale** : 9 caractères

### Exemples Valides
```typescript
// Containers
"CONT_A1B2"
"CONT_XYZ9"
"CONT_123A"

// Articles
"ART_C3D4"
"ART_MN78"
"ART_456B"
```

## Vérification d'Unicité

### Mécanisme Automatique
- **Vérification Supabase** : Les fonctions vérifient automatiquement l'unicité
- **Tentatives multiples** : Jusqu'à 100 tentatives avec format standard (4 caractères)
- **Extension automatique** : Si échec, passe à 6 caractères puis 8 caractères
- **Format TOUJOURS valide** : Aucun fallback avec timestamp ou caractères invalides
- **Logs détaillés** : Suivi des tentatives et conflits

### Stratégie de Génération
```typescript
// 1. Génération aléatoire (100 tentatives avec 4 caractères)
const qrCode = `CONT_${generateRandomString(4)}`;

// 2. Vérification en base
const exists = await isContainerQRCodeExists(qrCode);

// 3. Retry si collision
if (exists) {
  // Nouvelle tentative avec nouveau code aléatoire (format identique)
}

// 4. Extension automatique (100 tentatives avec 6 caractères)
const qrCode = `CONT_${generateRandomString(6)}`;

// 5. Dernier recours (8 caractères, format toujours valide)
const ultimateCode = `CONT_${generateRandomString(8)}`;
```

## Intégration Redux

### Dans les Thunks
```typescript
// ✅ CORRECT - Utilisation dans containersThunks.ts
export const createContainer = createAsyncThunk(
  'containers/createContainer',
  async (containerInput, { rejectWithValue }) => {
    // Générer QR code unique
    const qrCode = await generateUniqueContainerQRCode();
    
    const { data, error } = await supabase
      .from('containers')
      .insert({
        ...containerInput,
        qr_code: qrCode
      });
  }
);
```

### Dans les Composants
```typescript
// ✅ CORRECT - Utilisation dans ItemForm.tsx
const handleSubmit = async () => {
  await dispatch(createItem({
    name: item.name,
    qrCode: await generateUniqueItemQRCode(),
    // ... autres propriétés
  })).unwrap();
};
```

## Validation des QR Codes

### Fonctions de Validation
```typescript
import { isValidContainerQRCode, isValidItemQRCode } from '../utils/qrCodeGenerator';

// Validation format
const isValid = isValidContainerQRCode('CONT_ABC1'); // true
const isValid = isValidItemQRCode('ART_XYZ2');       // true
const isValid = isValidContainerQRCode('CONTAINER-1'); // false
```

### Regex de Validation
```typescript
// Containers : /^CONT_[A-Z0-9]{4}$/
// Articles : /^ART_[A-Z0-9]{4}$/
```

## Patterns Obligatoires

### Création d'Entités
```typescript
// ✅ CORRECT - Pattern pour créer une entité avec QR code
const createEntity = async (entityData) => {
  try {
    // 1. Générer QR code unique
    const qrCode = await generateUniqueContainerQRCode();
    
    // 2. Utiliser dans Redux thunk
    await dispatch(createContainer({
      ...entityData,
      qrCode
    })).unwrap();
    
  } catch (error) {
    // Gestion d'erreur
  }
};
```

### Mise à Jour avec Nouveau QR Code
```typescript
// ✅ CORRECT - Régénérer QR code lors de mise à jour
const updateEntity = async (id, updates) => {
  if (updates.requiresNewQRCode) {
    updates.qrCode = await generateUniqueContainerQRCode();
  }
  
  await dispatch(updateContainer({ id, updates }));
};
```

## Gestion d'Erreurs

### Cas d'Erreur Gérés
```typescript
// 1. Erreur de connexion Supabase
// 2. Maximum de tentatives atteint
// 3. Format de retour invalide
// 4. Timeout de génération
```

### Logging Automatique
```typescript
// Logs générés automatiquement :
console.log(`[QR Generator] QR code container unique généré: CONT_ABC1 (tentative 1)`);
console.log(`[QR Generator] QR code container CONT_XYZ2 existe déjà, nouvelle tentative...`);
console.warn(`[QR Generator] Utilisation du code de secours: CONT_1234`);
```

## Interdictions Absolues

### ❌ Génération Manuelle
```typescript
// ❌ INTERDIT - Génération manuelle de QR codes
const qrCode = `CONTAINER-${number}`;
const qrCode = `ITEM-${id}`;
const qrCode = Math.random().toString().substring(2, 8);
```

### ❌ Logique de QR Code Dispersée
```typescript
// ❌ INTERDIT - Logique QR code dans composants
const generateQR = () => `CONT_${Math.random()}`;

// ❌ INTERDIT - Formats différents
const qrCode = `BOX_${id}`;      // Format non standard
const qrCode = `cont_${id}`;     // Casse incorrecte
const qrCode = `CONT-${id}`;     // Séparateur incorrect
```

### ❌ Utilisation de generateId
```typescript
// ❌ INTERDIT - Ancienne fonction
import { generateId } from '../utils/identifierManager';
const qrCode = generateId('CONTAINER');
const qrCode = generateId('ITEM');
```

## Migration depuis Ancien Système

### Remplacement Systématique
```typescript
// Avant - generateId
import { generateId } from '../utils/identifierManager';
const qrCode = generateId('CONTAINER');

// Après - QRCodeGenerator
import { generateUniqueContainerQRCode } from '../utils/qrCodeGenerator';
const qrCode = await generateUniqueContainerQRCode();
```

### Vérification Migration
```bash
# Rechercher anciens patterns
grep -r "generateId\|CONTAINER-\|ITEM-" --include="*.ts" --include="*.tsx" .

# Vérifier nouveau pattern
grep -r "generateUniqueContainerQRCode\|generateUniqueItemQRCode" --include="*.ts" --include="*.tsx" .
```

## Avantages du Système

### Robustesse
- **Unicité garantie** par vérification base de données
- **Format standardisé** sur toute l'application
- **Gestion d'erreurs** intégrée avec fallbacks
- **Logging détaillé** pour débogage

### Maintenabilité
- **Point d'entrée unique** pour génération QR codes
- **Configuration centralisée** (longueur, format, etc.)
- **Tests unitaires** facilitées
- **Évolution future** simplifiée

### Performance
- **Cache potentiel** pour QR codes générés
- **Optimisation requêtes** Supabase
- **Retry intelligent** en cas de collision
- **Timeout protection** contre boucles infinies

Cette approche garantit la cohérence et l'unicité des QR codes dans toute l'application inventaire.

---
*From: @.cursor/rules/permissions-pwa-architecture.mdc*
---
# Architecture Permissions & PWA - Règles Obligatoires

## Règles Fondamentales

### Hooks Unifiés OBLIGATOIRES

**TOUJOURS utiliser ces 3 hooks uniquement pour les permissions/PWA :**

1. **`useCameraPermissions`** - Pour toute utilisation de caméra (scanner, photos)
2. **`usePWALifecycle`** - Pour la gestion du cycle de vie PWA iOS  
3. **`checkPhotoPermissions`** - Uniquement pour la galerie photo

### ❌ Interdictions Absolues

```typescript
// ❌ INTERDIT - Ne jamais créer ces fichiers
src/hooks/useScannerPermissions.ts
src/hooks/usePWAServiceWorker.ts
src/hooks/usePermissions.ts  
src/services/permissions.ts
src/utils/pwaPermissions.ts

// ❌ INTERDIT - Ne jamais utiliser expo-permissions (déprécié)
import * as Permissions from 'expo-permissions';

// ❌ INTERDIT - Ne jamais créer de Service Worker manuel
navigator.serviceWorker.register('/sw.js');
```

### ✅ Patterns Obligatoires

#### Scanner/Caméra
```typescript
import { useCameraPermissions } from '../hooks/useCameraPermissions';

const ScannerComponent = () => {
  const permissions = useCameraPermissions({
    enableLogging: __DEV__,
    timeoutMs: 10000,
    maxRetries: 3
  });

  if (permissions.isLoading) return <Loading />;
  if (!permissions.isGranted) return <PermissionRequest onRequest={permissions.requestPermission} />;
  
  return <CameraView />;
};
```

#### PWA Lifecycle App Principal
```typescript
import { usePWAServiceWorker } from '../hooks/usePWALifecycle';

const App = () => {
  const pwa = usePWAServiceWorker({
    onDataRefreshNeeded: () => {
      // Auto-refresh données critiques après réactivation PWA
      store.dispatch(fetchItems());
      store.dispatch(fetchCategories());
      store.dispatch(fetchContainers());
    }
  });
  
  return <AppContent />;
};
```

#### Galerie Photo
```typescript
import { checkPhotoPermissions } from '../utils/permissions';

const handleImagePicker = async () => {
  const hasPermission = await checkPhotoPermissions();
  if (!hasPermission) return;
  
  const result = await ImagePicker.launchImageLibraryAsync({...});
};
```

## Configurations Standard

### Development
```typescript
const permissions = useCameraPermissions({
  enableLogging: true,      // Debug actif
  timeoutMs: 15000,        // Plus de temps pour debug
  maxRetries: 5            // Plus de tentatives
});
```

### Production
```typescript
const permissions = useCameraPermissions({
  enableLogging: false,     // Pas de logs
  timeoutMs: 10000,        // Timeout standard
  maxRetries: 3            // Tentatives limitées
});
```

## Fichiers de Référence

### ✅ Fichiers Autorisés
- `src/hooks/useCameraPermissions.ts` - Hook unifié caméra
- `src/hooks/usePWALifecycle.ts` - Hook PWA moderne
- `src/utils/permissions.ts` - Seulement `checkPhotoPermissions`

### 📄 Documentation Complète
- `docs/PERMISSIONS_PWA_ARCHITECTURE.md` - Guide architectural complet

## Problèmes Typiques & Solutions

### Scanner Bloqué "Initialisation"
```typescript
const permissions = useCameraPermissions({
  timeoutMs: 8000,          // Réduire timeout
  maxRetries: 2,            // Moins de tentatives
  enableLogging: true       // Debug actif
});
```

### Permissions Redemandées
```typescript
// Vérifier la persistance
const permissions = useCameraPermissions({
  persistenceKey: '@app:camera_permission_v2'  // Clé correcte
});
```

### PWA iOS Bloquée après Inactivité
```typescript
const pwa = usePWAServiceWorker({
  inactivityThreshold: 20000,    // Réduire seuil
  enableAutoRefresh: true,
  onDataRefreshNeeded: refreshCriticalData
});
```

## Migration depuis Ancien Code

### Pattern de Remplacement
```typescript
// ❌ ANCIEN
const [permission, requestPermission] = useCameraPermissions();

// ✅ NOUVEAU
const permissions = useCameraPermissions();
// Utiliser: permissions.isGranted, permissions.requestPermission()
```
