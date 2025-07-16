# Suivi d'Implémentation - Gestion des Permissions

Ce document suit l'avancement de l'implémentation du nouveau système de permissions granulaires (Thème 4 du fichier TODO).

## Plan d'Action

-   [x] **1. Schéma de Données Supabase**
    -   [x] Ajouter la colonne `permissions` (`jsonb`) à la table `profiles`.
    -   [x] Créer un script pour mettre à jour les profils existants avec des permissions par défaut basées sur leur rôle.
    -   [x] Créer la fonction et le trigger `handle_new_user` pour initialiser les nouveaux utilisateurs avec des permissions par défaut.

-   [x] **2. Logique Applicative et Hooks**
    -   [x] Mettre à jour le `AuthContext` pour charger le profil complet de l'utilisateur (rôle + permissions).
    -   [x] Créer le hook `usePermissions()` pour vérifier facilement les droits dans les composants.
    -   [x] Créer le thunk Redux `updateUserPermissions` pour la sauvegarde des changements.
    -   [x] Créer les types TypeScript pour les permissions (`src/types/permissions.ts`).
    -   [x] Implémenter les fonctions de base de données pour les permissions (`getAllUsers`, `getUserProfile`, `updateUserPermissions`).
    -   [x] Créer le slice Redux `permissionsSlice` pour gérer l'état des permissions.
    -   [x] Ajouter les sélecteurs Redux pour les permissions dans `selectors.ts`.

-   [ ] **3. Interface d'Administration**
    -   [ ] Créer la page `app/(stack)/admin/permissions.tsx`.
    -   [ ] Sécuriser l'accès de la page au rôle `ADMIN`.
    -   [ ] Lister les utilisateurs.
    -   [ ] Développer le panneau de gestion des permissions avec des `Switch` pour chaque droit.

-   [ ] **4. Intégration dans l'Application**
    -   [ ] Remplacer toutes les anciennes vérifications de rôle par le nouveau hook `usePermissions()`.
    -   [ ] Conditionner l'affichage des boutons (Supprimer, etc.).
    -   [ ] Conditionner l'édition des champs (prix d'achat, etc.).
    -   [ ] Conditionner l'accès aux pages et onglets de navigation.
