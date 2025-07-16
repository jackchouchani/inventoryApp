import { useAuth } from '../contexts/AuthContext';

/**
 * Hook pour vérifier les permissions utilisateur de manière granulaire
 * 
 * @returns {Object} - Objet contenant les méthodes et données de permissions
 */
export function useUserPermissions() {
  const { user, isLoading } = useAuth();
  
  /**
   * Vérifie si l'utilisateur a une permission spécifique
   * 
   * @param {string} permission - Permission à vérifier (ex: 'items.create', 'features.scanner')
   * @returns {boolean} - True si l'utilisateur a la permission, false sinon
   */
  const can = (permission: string): boolean | undefined => {
    // Si encore en chargement, retourner undefined
    if (isLoading) return undefined;
    
    if (!user || !user.permissions) {
      // Ne pas logger si l'utilisateur n'est simplement pas connecté
      return false;
    }
    
    const parts = permission.split('.');
    if (parts.length !== 2) {
      console.warn(`[useUserPermissions] Format de permission invalide: ${permission}`);
      return false;
    }
    
    const [section, action] = parts;
    const sectionPermissions = user.permissions[section as keyof typeof user.permissions];
    
    if (!sectionPermissions) {
      // Ne pas logger - cela peut arriver normalement pendant l'initialisation
      return false;
    }
    
    return sectionPermissions[action as keyof typeof sectionPermissions] === true;
  };
  
  /**
   * Vérifie si l'utilisateur a un rôle spécifique ou supérieur
   * 
   * @param {string} role - Rôle à vérifier ('ADMIN', 'MANAGER', 'OPERATOR')
   * @returns {boolean} - True si l'utilisateur a le rôle ou un rôle supérieur
   */
  const hasRole = (role: 'ADMIN' | 'MANAGER' | 'OPERATOR'): boolean => {
    if (!user) return false;
    
    const roleHierarchy = {
      'OPERATOR': 1,
      'MANAGER': 2,
      'ADMIN': 3
    };
    
    const userRoleLevel = roleHierarchy[user.role] || 0;
    const requiredRoleLevel = roleHierarchy[role] || 0;
    
    return userRoleLevel >= requiredRoleLevel;
  };
  
  /**
   * Vérifie si l'utilisateur a TOUTES les permissions listées
   * 
   * @param {string[]} permissions - Liste des permissions à vérifier
   * @returns {boolean} - True si l'utilisateur a toutes les permissions
   */
  const canAll = (permissions: string[]): boolean => {
    return permissions.every(permission => can(permission));
  };
  
  /**
   * Vérifie si l'utilisateur a AU MOINS UNE des permissions listées
   * 
   * @param {string[]} permissions - Liste des permissions à vérifier
   * @returns {boolean} - True si l'utilisateur a au moins une permission
   */
  const canAny = (permissions: string[]): boolean => {
    return permissions.some(permission => can(permission));
  };
  
  return {
    // Méthodes principales
    can,
    hasRole,
    canAll,
    canAny,
    
    // Données utilisateur
    user,
    isAuthenticated: !!user,
    isLoading,
    
    // Permissions complètes pour debug ou usage avancé
    permissions: user?.permissions || null,
    
    // Helpers pour les permissions courantes
    canCreateItems: can('items.create'),
    canUpdateItems: can('items.update'),
    canDeleteItems: can('items.delete'),
    canReadItems: can('items.read'),
    canExportItems: can('items.export'),
    
    canCreateCategories: can('categories.create'),
    canUpdateCategories: can('categories.update'),
    canDeleteCategories: can('categories.delete'),
    canReadCategories: can('categories.read'),
    
    canCreateContainers: can('containers.create'),
    canUpdateContainers: can('containers.update'),
    canDeleteContainers: can('containers.delete'),
    canReadContainers: can('containers.read'),
    
    canUseScanner: can('features.scanner'),
    canViewLocations: can('features.locations') || false, // Pas dans tes permissions actuelles
    canViewSources: can('features.sources'),
    canViewInvoices: can('features.multiReceipt'), // Correspond à multiReceipt dans tes permissions
    canViewAuditLog: can('features.auditLog'),
    canViewLabels: can('features.labels') || false, // Pas dans tes permissions actuelles
    canViewDashboard: can('features.dashboard') || false, // Pas dans tes permissions actuelles
    
    canViewPurchasePrice: can('stats.viewPurchasePrice'),
    
    canManageUsers: can('settings.canManageUsers'),
    
    // Vérifications de rôle
    isAdmin: hasRole('ADMIN'),
    isManager: hasRole('MANAGER'),
    isOperator: hasRole('OPERATOR'),
  };
}