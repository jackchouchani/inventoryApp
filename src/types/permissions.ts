// Types pour la gestion des permissions utilisateur

export interface AppPermissions {
  items: { create: boolean; update: boolean; delete: boolean };
  categories: { create: boolean; update: boolean; delete: boolean };
  containers: { create: boolean; update: boolean; delete: boolean };
  features: { 
    scanner: boolean; 
    locations: boolean; 
    sources: boolean; 
    invoices: boolean; 
    auditLog: boolean; 
    labels: boolean; 
    dashboard: boolean 
  };
  stats: { viewPurchasePrice: boolean };
  settings: { canManageUsers: boolean };
}

export interface UserProfile {
  id: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR';
  permissions: AppPermissions;
}

export interface UserPermissionsUpdate {
  permissions: AppPermissions;
}

export interface UserProfileUpdate {
  role?: 'ADMIN' | 'MANAGER' | 'OPERATOR';
  permissions?: AppPermissions;
}

export interface InviteUserRequest {
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR';
}

// Permissions par défaut selon le rôle
export const DEFAULT_PERMISSIONS: Record<UserProfile['role'], AppPermissions> = {
  ADMIN: {
    items: { create: true, update: true, delete: true },
    categories: { create: true, update: true, delete: true },
    containers: { create: true, update: true, delete: true },
    features: { 
      scanner: true, 
      locations: true, 
      sources: true, 
      invoices: true, 
      auditLog: true, 
      labels: true, 
      dashboard: true 
    },
    stats: { viewPurchasePrice: true },
    settings: { canManageUsers: true }
  },
  MANAGER: {
    items: { create: true, update: true, delete: true },
    categories: { create: true, update: true, delete: true },
    containers: { create: true, update: true, delete: true },
    features: { 
      scanner: true, 
      locations: true, 
      sources: true, 
      invoices: true, 
      auditLog: true, 
      labels: true, 
      dashboard: true 
    },
    stats: { viewPurchasePrice: true },
    settings: { canManageUsers: false }
  },
  OPERATOR: {
    items: { create: true, update: true, delete: false },
    categories: { create: false, update: false, delete: false },
    containers: { create: false, update: false, delete: false },
    features: { 
      scanner: true, 
      locations: true, 
      sources: true, 
      invoices: true, 
      auditLog: false, 
      labels: true, 
      dashboard: false 
    },
    stats: { viewPurchasePrice: false },
    settings: { canManageUsers: false }
  }
};