# 🔧 Plan de Migration Architecture Redux

## 🎯 Objectif
Éliminer les accès directs à `database` et centraliser via Redux pour une architecture cohérente.

## ✅ DÉJÀ CORRECT (À GARDER)
- `src/store/itemsThunks.ts` ✅ - Architecture Redux correcte
- `src/hooks/useOptimizedSelectors.ts` ✅ - Sélecteurs optimisés
- `src/store/containersSlice.ts` ✅ - Slice Redux approprié 
- `src/services/imageService.ts` ✅ - Service spécialisé (OK d'accéder direct)

## 🆕 CRÉÉ AUJOURD'HUI
- `src/store/categoriesThunks.ts` ✅ - Nouveaux thunks categories
- `src/store/containersThunks.ts` ✅ - Nouveaux thunks containers  
- `src/hooks/useCategoriesOptimized.ts` ✅ - Hook optimisé categories
- `src/hooks/useContainersOptimized.ts` ✅ - Hook optimisé containers

## 📋 MIGRATIONS À FAIRE

### PHASE 1 - Hooks (Impact immédiat)

#### 1. `src/hooks/useCategories.ts` ❌ → useCategoriesOptimized ✅
```typescript
// AVANT (accès direct database)
const { categories, isLoading } = useCategories();

// APRÈS (Redux thunks)
const { categories, isLoading } = useCategoriesOptimized();
```

#### 2. `src/hooks/useContainers.ts` ❌ → useContainersOptimized ✅
```typescript  
// AVANT
const { data: containers } = useContainers();

// APRÈS  
const { data: containers } = useContainersOptimized();
```

#### 3. `src/hooks/useStockActions.ts` - Nettoyer les accès database
- Supprimer `const { database } = await import('../database/database');`
- Utiliser uniquement les thunks Redux

### PHASE 2 - Composants (Remplacer accès database)

#### 1. `app/category/add.tsx` ❌
```typescript
// AVANT
await database.addCategory(categoryInput);
dispatch(addNewCategory({...}));

// APRÈS
await dispatch(createCategory(categoryInput)).unwrap();
```

#### 2. `src/components/ItemForm.tsx` ❌
```typescript
// AVANT
await database.addItem(data);
dispatch(addItem(itemForRedux));

// APRÈS
await dispatch(createItem({
  name: data.name,
  description: data.description,
  purchasePrice: data.purchasePrice,
  sellingPrice: data.sellingPrice,
  categoryId: data.categoryId,
  containerId: data.containerId,
  qrCode: data.qrCode,
  photo_storage_url: data.photo_storage_url
})).unwrap();
```

#### 3. `src/components/ItemEditForm.tsx` ❌  
```typescript
// AVANT
await database.updateItem(adaptedItem.id, itemToUpdateToSendToDB);
dispatch(updateItem(updatedItem));

// APRÈS
await dispatch(updateItem({
  id: adaptedItem.id,
  updates: itemToUpdateToSendToDB
})).unwrap();
```

### PHASE 3 - Hooks avancés (Remplacer logique interne)

#### 1. `src/hooks/useContainerManagement.ts` ❌
- Remplacer `database.addContainer()` → `dispatch(createContainer())`
- Remplacer `database.updateContainer()` → `dispatch(updateContainer())`
- Remplacer `database.getContainers()` → utiliser sélecteurs Redux

#### 2. `src/hooks/useScannerWorkflow.ts` ❌
- Remplacer `databaseInterface.getContainerByQRCode()` → `dispatch(fetchContainerByQRCode())`
- Remplacer `databaseInterface.updateItem()` → `dispatch(updateItem())`

## 🚀 ORDRE D'EXÉCUTION RECOMMANDÉ

### Étape 1 : Hooks de Base (30 min)
1. Migrer `useCategories.ts` → `useCategoriesOptimized.ts`
2. Migrer `useContainers.ts` → `useContainersOptimized.ts`  
3. Nettoyer `useStockActions.ts`

### Étape 2 : Composants Forms (45 min)
1. Migrer `ItemForm.tsx` 
2. Migrer `ItemEditForm.tsx`
3. Migrer `app/category/add.tsx`

### Étape 3 : Hooks Complexes (30 min)  
1. Migrer `useContainerManagement.ts`
2. Migrer `useScannerWorkflow.ts`

### Étape 4 : Tests et Validation (15 min)
1. Tester création/édition d'items
2. Tester création/édition de catégories  
3. Tester scan workflow

## 🎯 BÉNÉFICES ATTENDUS

### Architecture
- ✅ Une seule source de vérité (Redux store)
- ✅ Cohérence des patterns d'accès aux données
- ✅ Meilleure gestion d'erreurs centralisée
- ✅ Invalidation automatique et synchronisation

### Performance  
- ✅ Cache intelligent via Redux selectors
- ✅ Éviter les doublons de requêtes
- ✅ Optimistic updates cohérents

### Maintenance
- ✅ Code plus prévisible et testable
- ✅ Éliminer les conflits de synchronisation
- ✅ Debugging facilité via Redux DevTools

## 📝 NOTES IMPORTANTES

1. **NE PAS TOUCHER** à `imageService.ts` - Service spécialisé qui a sa propre logique
2. **GARDER** tous les hooks optimisés existants dans `useOptimizedSelectors.ts`
3. **CONSERVER** les thunks `itemsThunks.ts` qui sont déjà bien structurés  
4. **TESTER** chaque migration avant de passer à la suivante 