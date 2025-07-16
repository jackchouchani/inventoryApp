import { DEFAULT_PERMISSIONS } from '../types/permissions';
import type { AppPermissions, UserProfile } from '../types/permissions';
import { database } from '../database/database';

/**
 * Normalise les permissions pour qu'elles correspondent à la structure AppPermissions
 */
export const normalizePermissions = (permissions: any): AppPermissions => {
  return {
    items: {
      create: permissions.items?.create ?? false,
      update: permissions.items?.update ?? false,
      delete: permissions.items?.delete ?? false
    },
    categories: {
      create: permissions.categories?.create ?? false,
      update: permissions.categories?.update ?? false,
      delete: permissions.categories?.delete ?? false
    },
    containers: {
      create: permissions.containers?.create ?? false,
      update: permissions.containers?.update ?? false,
      delete: permissions.containers?.delete ?? false
    },
    features: {
      scanner: permissions.features?.scanner ?? false,
      locations: permissions.features?.locations ?? false,
      sources: permissions.features?.sources ?? false,
      invoices: permissions.features?.invoices ?? false,
      auditLog: permissions.features?.auditLog ?? false,
      labels: permissions.features?.labels ?? false,
      dashboard: permissions.features?.dashboard ?? false
    },
    stats: {
      viewPurchasePrice: permissions.stats?.viewPurchasePrice ?? false
    },
    settings: {
      canManageUsers: permissions.settings?.canManageUsers ?? false
    }
  };
};

/**
 * Applique les permissions par défaut selon le rôle
 * Utilise d'abord les permissions par défaut personnalisées depuis la base de données,
 * puis les permissions par défaut codées en dur si aucune n'est trouvée
 */
export const applyDefaultPermissionsForRole = async (role: UserProfile['role']): Promise<AppPermissions> => {
  try {
    // Tenter d'obtenir les permissions par défaut personnalisées depuis la base de données
    const customDefaultPermissions = await database.getDefaultPermissionsForRole(role);
    return { ...customDefaultPermissions };
  } catch (error) {
    console.error('[applyDefaultPermissionsForRole] Erreur lors de la récupération des permissions par défaut:', error);
    // Fallback vers les permissions par défaut codées en dur
    return { ...DEFAULT_PERMISSIONS[role] };
  }
};

/**
 * Fusionne les permissions existantes avec les permissions par défaut du nouveau rôle
 * Garde les permissions personnalisées qui ont été accordées manuellement
 */
export const mergePermissionsWithRole = (
  currentPermissions: AppPermissions, 
  newRole: UserProfile['role']
): AppPermissions => {
  const defaultPermissions = DEFAULT_PERMISSIONS[newRole];
  
  // Stratégie : prendre le maximum entre permissions actuelles et permissions par défaut du rôle
  const mergedPermissions: AppPermissions = {
    items: {
      create: currentPermissions.items.create || defaultPermissions.items.create,
      update: currentPermissions.items.update || defaultPermissions.items.update,
      delete: currentPermissions.items.delete || defaultPermissions.items.delete,
    },
    categories: {
      create: currentPermissions.categories.create || defaultPermissions.categories.create,
      update: currentPermissions.categories.update || defaultPermissions.categories.update,
      delete: currentPermissions.categories.delete || defaultPermissions.categories.delete,
    },
    containers: {
      create: currentPermissions.containers.create || defaultPermissions.containers.create,
      update: currentPermissions.containers.update || defaultPermissions.containers.update,
      delete: currentPermissions.containers.delete || defaultPermissions.containers.delete,
    },
    features: {
      scanner: currentPermissions.features.scanner || defaultPermissions.features.scanner,
      locations: currentPermissions.features.locations || defaultPermissions.features.locations,
      sources: currentPermissions.features.sources || defaultPermissions.features.sources,
      invoices: currentPermissions.features.invoices || defaultPermissions.features.invoices,
      auditLog: currentPermissions.features.auditLog || defaultPermissions.features.auditLog,
      labels: currentPermissions.features.labels || defaultPermissions.features.labels,
      dashboard: currentPermissions.features.dashboard || defaultPermissions.features.dashboard,
    },
    stats: {
      viewPurchasePrice: currentPermissions.stats.viewPurchasePrice || defaultPermissions.stats.viewPurchasePrice,
    },
    settings: {
      canManageUsers: currentPermissions.settings.canManageUsers || defaultPermissions.settings.canManageUsers,
    }
  };
  
  return mergedPermissions;
};

/**
 * Obtient la couleur associée à un rôle
 */
export const getRoleColor = (role: UserProfile['role']) => {
  switch (role) {
    case 'ADMIN':
      return '#e74c3c'; // Rouge
    case 'MANAGER':
      return '#f39c12'; // Orange
    case 'OPERATOR':
      return '#3498db'; // Bleu
    default:
      return '#95a5a6'; // Gris
  }
};

/**
 * Obtient le label français d'un rôle
 */
export const getRoleLabel = (role: UserProfile['role']) => {
  switch (role) {
    case 'ADMIN':
      return 'Administrateur';
    case 'MANAGER':
      return 'Gestionnaire';
    case 'OPERATOR':
      return 'Opérateur';
    default:
      return role;
  }
};