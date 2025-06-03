import { StyleSheet, Platform, ImageResizeMode, Dimensions } from 'react-native';
import type { AppThemeType } from '../contexts/ThemeContext';

// Interface pour les styles communs
interface CommonStyles {
  container: any;
  surface: any;
  card: any;
  button: any;
  text: any;
  input: any;
  shadow: any;
}

// Type pour les noms de composants supportés
type ComponentName = 
  | 'ItemCard'
  | 'ItemList'
  | 'ItemForm'
  | 'CategoryCard'
  | 'CategoryContent'
  | 'ContainerCard'
  | 'ContainerContents'
  | 'Scanner'
  | 'Stats'
  | 'FilterBar'
  | 'Settings'
  | 'Labels'
  | 'MultiReceipt'
  | 'CommonHeader'
  | 'Common';

class StyleFactory {
  private static cache = new Map<string, any>();
  private static themeVersion = 0;

  /**
   * Invalide le cache lors d'un changement de thème
   */
  static invalidateCache(): void {
    this.cache.clear();
    this.themeVersion++;
  }

  /**
   * Génère une clé de cache unique
   */
  private static getCacheKey(theme: AppThemeType, componentName: ComponentName, variant?: string): string {
    const themeId = theme.primary + theme.background; // Utiliser les couleurs pour identifier le thème
    return `${componentName}-${themeId}-${this.themeVersion}-${variant || 'default'}`;
  }

  /**
   * Récupère les styles mis en cache ou les génère
   */
  static getThemedStyles<T = any>(
    theme: AppThemeType, 
    componentName: ComponentName, 
    variant?: string
  ): T {
    const cacheKey = this.getCacheKey(theme, componentName, variant);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    const styles = this.generateStyles(theme, componentName, variant);
    this.cache.set(cacheKey, styles);
    return styles;
  }

  /**
   * Génère les styles pour un composant spécifique
   */
  private static generateStyles(theme: AppThemeType, componentName: ComponentName, variant?: string): any {
    const commonStyles = this.getCommonStyles(theme);
    
    switch (componentName) {
      case 'ItemCard':
        return this.getItemCardStyles(theme, commonStyles, variant);
      case 'ItemList':
        return this.getItemListStyles(theme, commonStyles);
      case 'ItemForm':
        return this.getItemFormStyles(theme, commonStyles);
      case 'CategoryCard':
        return this.getCategoryCardStyles(theme, commonStyles);
      case 'CategoryContent':
        return this.getCategoryContentStyles(theme, commonStyles);
      case 'ContainerCard':
        return this.getContainerCardStyles(theme, commonStyles);
      case 'ContainerContents':
        return this.getContainerContentsStyles(theme, commonStyles);
      case 'Scanner':
        return this.getScannerStyles(theme, commonStyles);
      case 'Stats':
        return this.getStatsStyles(theme, commonStyles);
      case 'FilterBar':
        return this.getFilterBarStyles(theme, commonStyles);
      case 'Settings':
        return this.getSettingsStyles(theme, commonStyles);
      case 'Labels':
        return this.getLabelsStyles(theme, commonStyles);
      case 'MultiReceipt':
        return this.getMultiReceiptStyles(theme, commonStyles);
      case 'CommonHeader':
        return this.getCommonHeaderStyles(theme, commonStyles);
      case 'Common':
        return commonStyles;
      default:
        return {};
    }
  }

  /**
   * Styles communs réutilisables
   */
  private static getCommonStyles(theme: AppThemeType): CommonStyles {
    return {
      container: {
        flex: 1,
        backgroundColor: theme.background,
      },
      surface: {
        backgroundColor: theme.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.border,
      },
      card: {
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: 16,
        marginVertical: 6,
        marginHorizontal: 12,
        borderWidth: 1,
        borderColor: theme.border,
        ...Platform.select({
          web: {
            boxShadow: `0 2px 8px ${theme.backdrop}`,
          },
          default: {
            shadowColor: theme.backdrop,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          },
        }),
      },
      button: {
        backgroundColor: theme.primary,
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
      },
      text: {
        primary: {
          color: theme.text.primary,
          fontSize: 16,
        },
        secondary: {
          color: theme.text.secondary,
          fontSize: 14,
        },
        label: {
          color: theme.text.primary,
          fontSize: 14,
          fontWeight: '500',
          marginBottom: 8,
        },
      },
      input: {
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: Platform.OS === 'web' ? 12 : 8,
        fontSize: 16,
        color: theme.text.primary,
      },
      shadow: Platform.select({
        web: {
          boxShadow: `0 2px 8px ${theme.backdrop}`,
        },
        default: {
          shadowColor: theme.backdrop,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        },
      }),
    };
  }

  /**
   * Styles spécifiques pour ItemCard
   */
  private static getItemCardStyles(theme: AppThemeType, common: CommonStyles, variant?: string) {
    const baseStyles = {
      container: {
        ...common.card,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        padding: 12,
      },
      imageContainer: {
        width: 80,
        height: 80,
        borderRadius: 8,
        backgroundColor: theme.surface,
        marginRight: 12,
        overflow: 'hidden' as const,
      },
      image: {
        width: '100%' as const,
        height: '100%' as const,
        resizeMode: 'cover' as ImageResizeMode,
      },
      contentContainer: {
        flex: 1,
        justifyContent: 'space-between' as const,
      },
      titleRow: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'flex-start' as const,
        marginBottom: 4,
      },
      name: {
        ...common.text.primary,
        fontWeight: '600' as const,
        flex: 1,
      },
      price: {
        ...common.text.primary,
        fontWeight: '700' as const,
        color: theme.primary,
      },
      description: {
        ...common.text.secondary,
        marginBottom: 8,
      },
      statusContainer: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
      },
      statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start' as const,
      },
      statusText: {
        fontSize: 12,
        fontWeight: '500' as const,
      },
      actionButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        marginLeft: 8,
      },
    };

    // Variations selon le variant
    if (variant === 'compact') {
      return StyleSheet.create({
        ...baseStyles,
        container: {
          ...baseStyles.container,
          padding: 8,
        },
        imageContainer: {
          ...baseStyles.imageContainer,
          width: 60,
          height: 60,
        },
      });
    }

    return StyleSheet.create(baseStyles);
  }

  /**
   * Styles spécifiques pour ItemList
   */
  private static getItemListStyles(theme: AppThemeType, common: CommonStyles) {
    return StyleSheet.create({
      container: common.container,
      emptyContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        padding: 40,
      },
      emptyText: {
        ...common.text.secondary,
        fontSize: 18,
        textAlign: 'center' as const,
      },
      loadingContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
      },
      loadingMoreContainer: {
        flexDirection: 'row' as const,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        padding: 16,
      },
      loadingMoreText: {
        ...common.text.secondary,
        marginLeft: 8,
      },
      errorContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        padding: 20,
      },
      errorText: {
        ...common.text.primary,
        fontSize: 16,
        textAlign: 'center' as const,
        marginBottom: 8,
      },
      errorDetails: {
        ...common.text.secondary,
        fontSize: 12,
        textAlign: 'center' as const,
      },
      filterToggleButton: {
        flexDirection: 'row' as const,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        padding: 8,
        margin: 8,
        borderRadius: 8,
        borderWidth: 1,
      },
      filterToggleText: {
        fontSize: 14,
        fontWeight: '500' as const,
      },
      modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center' as const,
        padding: 20,
      },
      modalContent: {
        padding: 20,
        borderRadius: 12,
        ...common.shadow,
      },
      modalTitle: {
        fontSize: 18,
        fontWeight: '600' as const,
        textAlign: 'center' as const,
        marginBottom: 20,
      },
      modalLabel: {
        fontSize: 14,
        fontWeight: '500' as const,
        marginBottom: 10,
      },
    });
  }

  /**
   * Styles spécifiques pour ItemForm
   */
  private static getItemFormStyles(theme: AppThemeType, common: CommonStyles) {
    return StyleSheet.create({
      container: {
        ...common.container,
        padding: 16,
      },
      content: {
        flex: 1,
      },
      loadingContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
      },
      scrollContainer: {
        flexGrow: 1,
      },
      section: {
        marginBottom: 24,
      },
      sectionTitle: {
        ...common.text.primary,
        fontSize: 18,
        fontWeight: '600' as const,
        marginBottom: 16,
      },
      inputGroup: {
        marginBottom: 16,
      },
      label: common.text.label,
      input: common.input,
      textArea: {
        ...common.input,
        height: 80,
        textAlignVertical: 'top' as const,
      },
      buttonContainer: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        marginTop: 24,
      },
      button: common.button,
      buttonSecondary: {
        ...common.button,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
      },
      buttonText: {
        color: theme.text.onPrimary,
        fontWeight: '600' as const,
      },
      buttonTextSecondary: {
        color: theme.text.primary,
        fontWeight: '600' as const,
      },
    });
  }

  /**
   * Styles pour CategoryCard
   */
  private static getCategoryCardStyles(theme: AppThemeType, common: CommonStyles) {
    return StyleSheet.create({
      // Styles de base hérités
      container: common.container,
      header: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        marginBottom: 8,
      },
      icon: {
        marginRight: 12,
      },
      title: {
        ...common.text.primary,
        fontSize: 18,
        fontWeight: '600' as const,
        flex: 1,
      },
      description: {
        ...common.text.secondary,
        marginBottom: 12,
      },
      stats: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
      },
      statsText: {
        ...common.text.secondary,
        fontSize: 12,
      },
      
      // Styles étendus pour la page de gestion
      topBar: {
        height: Platform.OS === 'ios' ? 44 : 56,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 16,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      backButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        padding: 8,
        marginLeft: -8,
      },
      backButtonText: {
        fontSize: 17,
        color: theme.primary,
        marginLeft: -4,
      },
      headerSection: {
        padding: 16,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      pageTitle: {
        fontSize: 28,
        fontWeight: '700' as const,
        color: theme.text.primary,
        marginBottom: 16,
      },
      addButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: theme.primary,
        padding: 12,
        borderRadius: 12,
        ...Platform.select({
          web: {
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
          },
          default: {
            elevation: 3,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
          },
        }),
      },
      addButtonText: {
        color: theme.text.onPrimary,
        fontSize: 16,
        fontWeight: '600' as const,
        marginLeft: 8,
      },
      list: {
        padding: 16,
      },
      categoryCard: {
        backgroundColor: theme.surface,
        borderRadius: 12,
        marginHorizontal: 16,
        marginVertical: 8,
        padding: 16,
        ...Platform.select({
          web: {
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
          },
          default: {
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
          },
        }),
      },
      categoryContent: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
      },
      iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.primaryLight || theme.primary + '20',
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        marginRight: 12,
      },
      categoryInfo: {
        flex: 1,
      },
      categoryName: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: theme.text.primary,
        marginBottom: 4,
      },
      categoryDescription: {
        fontSize: 14,
        color: theme.text.secondary,
      },
      categoryActions: {
        flexDirection: 'row' as const,
        justifyContent: 'flex-end' as const,
        marginTop: 12,
        gap: 8,
      },
      actionButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: theme.primaryLight || theme.primary + '20',
      },
      deleteButton: {
        backgroundColor: theme.danger.background || theme.danger.main + '20',
      },
      loadingContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        backgroundColor: theme.background,
      },
      loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: theme.text.secondary,
      },
      emptyState: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        padding: 20,
      },
      emptyStateText: {
        fontSize: 18,
        fontWeight: '600' as const,
        color: theme.text.secondary,
        marginTop: 16,
      },
      emptyStateSubtext: {
        fontSize: 14,
        color: theme.text.secondary,
        marginTop: 8,
        textAlign: 'center' as const,
      },
      errorContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        padding: 20,
        backgroundColor: theme.background,
      },
      errorTitle: {
        fontSize: 20,
        fontWeight: '600' as const,
        color: theme.text.primary,
        marginTop: 16,
        marginBottom: 8,
      },
      errorText: {
        color: theme.danger.main,
        fontSize: 14,
        marginTop: 4,
      },
      retryButton: {
        marginTop: 16,
        padding: 12,
        backgroundColor: theme.primary,
        borderRadius: 8,
      },
      retryButtonText: {
        color: theme.text.onPrimary,
        fontSize: 16,
        fontWeight: '600' as const,
      },
    });
  }

  /**
   * Styles pour CategoryContent
   */
  private static getCategoryContentStyles(theme: AppThemeType, common: CommonStyles) {
    return StyleSheet.create({
      container: common.container,
      
      // ===== LOADING & ERROR STATES =====
      loadingContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        padding: 32,
      },
      loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: theme.text.secondary,
        textAlign: 'center' as const,
      },
      errorContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        padding: 32,
      },
      errorTitle: {
        fontSize: 18,
        fontWeight: '600' as const,
        color: theme.danger.main,
        marginTop: 16,
        marginBottom: 8,
        textAlign: 'center' as const,
      },
      errorText: {
        fontSize: 16,
        color: theme.text.secondary,
        textAlign: 'center' as const,
      },
      
      // ===== CATEGORY INFO CONTAINER =====
      categoryInfoContainer: {
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        paddingVertical: 16,
        paddingHorizontal: 16,
      },
      categoryHeader: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        marginBottom: 16,
      },
      categoryIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: theme.primary + '15',
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        marginRight: 16,
      },
      categoryDetails: {
        flex: 1,
      },
      categoryName: {
        fontSize: 20,
        fontWeight: '600' as const,
        color: theme.text.primary,
        marginBottom: 4,
      },
      categoryDescription: {
        fontSize: 16,
        color: theme.text.secondary,
        lineHeight: 22,
      },
      
      // ===== STATISTICS CONTAINER =====
      statsContainer: {
        flexDirection: 'row' as const,
        justifyContent: 'space-around' as const,
        paddingTop: 16,
      },
      statItem: {
        alignItems: 'center' as const,
      },
      statValue: {
        fontSize: 24,
        fontWeight: '700' as const,
        color: theme.text.primary,
        marginBottom: 4,
      },
      statLabel: {
        fontSize: 14,
        color: theme.text.secondary,
        fontWeight: '500' as const,
      },
      
      // ===== EMPTY STATE =====
      emptyState: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        paddingVertical: 64,
        paddingHorizontal: 32,
      },
      emptyStateText: {
        fontSize: 18,
        fontWeight: '600' as const,
        color: theme.text.secondary,
        marginTop: 16,
        marginBottom: 8,
        textAlign: 'center' as const,
      },
      emptyStateSubtext: {
        fontSize: 16,
        color: theme.text.secondary,
        textAlign: 'center' as const,
        lineHeight: 22,
      },
      
      // ===== VIRTUAL LIST WRAPPER =====
      listWrapper: {
        flex: 1,
        backgroundColor: theme.background,
      }
    });
  }

  /**
   * Styles pour ContainerCard
   */
  private static getContainerCardStyles(theme: AppThemeType, common: CommonStyles) {
    return StyleSheet.create({
      // Styles de base du container
      container: {
        flex: 1,
        backgroundColor: theme.background,
      },
      loadingContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        backgroundColor: theme.background,
      },
      loadingText: {
        marginTop: 10,
        color: theme.text.secondary,
      },
      
      // Header et navigation
      topBar: {
        height: Platform.OS === 'ios' ? 44 : 56,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 16,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      backButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
      },
      backButtonText: {
        fontSize: 17,
        color: theme.primary,
        marginLeft: -4,
      },
      
      // Modal et formulaire
      modalContent: {
        flex: 1,
        backgroundColor: theme.background,
      },
      scrollContainer: {
        flexGrow: 1,
        padding: 16,
      },
      modalHeader: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        padding: 16,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      modalTitle: {
        fontSize: 18,
        fontWeight: '600' as const,
        color: theme.text.primary,
      },
      headerSpacer: {
        width: 70,
      },
      headerActions: {
        flexDirection: 'row' as const,
        gap: 16,
      },
      cancelButton: {
        padding: 8,
      },
      cancelButtonText: {
        color: theme.primary,
        fontSize: 16,
      },
      actionButton: {
        padding: 8,
      },
      deleteButton: {
        marginLeft: 8,
      },
      
      // Card de base (héritée)
      card: common.card,
      header: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        marginBottom: 8,
      },
      title: {
        ...common.text.primary,
        fontSize: 16,
        fontWeight: '600' as const,
      },
      number: {
        ...common.text.secondary,
        fontSize: 14,
      },
      description: {
        ...common.text.secondary,
        marginBottom: 12,
      },
      footer: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
      },
      itemCount: {
        ...common.text.primary,
        fontWeight: '500' as const,
      },
      
      // Styles spécifiques à la page
      containerDetails: {
        backgroundColor: theme.surface,
        padding: 16,
        marginBottom: 8,
      },
      
      // ===== CONTAINER GRID =====
      grid: {
        padding: 8,
        flexGrow: 1,
      },
      gridRow: {
        justifyContent: 'space-between' as const,
        marginBottom: 8,
      },
      containerCard: {
        flex: 0.48, // 48% de largeur pour 2 colonnes avec espace
        aspectRatio: 1.2, // Ratio légèrement rectangulaire pour plus de contenu
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: 16,
        marginVertical: 4,
        borderWidth: 1,
        borderColor: theme.border,
        justifyContent: 'space-between' as const,
        minHeight: 120,
        ...Platform.select({
          web: {
            boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
          },
          default: {
            elevation: 3,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
          },
        }),
      },
      containerName: {
        fontSize: 16,
        fontWeight: '700' as const,
        marginBottom: 4,
        color: theme.text.primary,
      },
      containerNumber: {
        fontSize: 14,
        color: theme.text.secondary,
        marginBottom: 8,
        fontWeight: '500' as const,
      },
      statsContainer: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        marginTop: 'auto' as const,
      },
      
      detailRow: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        marginBottom: 8,
      },
      detailLabel: {
        fontSize: 16,
        fontWeight: '500' as const,
        color: theme.text.secondary,
        width: 100,
      },
      detailValue: {
        fontSize: 16,
        color: theme.text.primary,
        flex: 1,
      },
      
      // Gestion des items
      itemCard: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        backgroundColor: theme.surface,
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
        borderLeftWidth: 4,
        borderLeftColor: theme.primary,
        ...common.shadow,
      },
      itemInfo: {
        flex: 1,
      },
      itemName: {
        fontSize: 16,
        fontWeight: '500' as const,
        marginBottom: 4,
        color: theme.text.primary,
      },
      itemPrice: {
        fontSize: 14,
        color: theme.text.secondary,
      },
      
      // Filtres et recherche
      searchInput: {
        backgroundColor: theme.surface,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        fontSize: 16,
        color: theme.text.primary,
        borderWidth: 1,
        borderColor: theme.border,
        ...common.shadow,
      },
      categoryChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: theme.surface,
        marginRight: 8,
        borderWidth: 1,
        borderColor: theme.border,
      },
      categoryChipSelected: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
      },
      categoryChipText: {
        fontSize: 14,
        color: theme.text.secondary,
      },
      categoryChipTextSelected: {
        color: theme.text.onPrimary,
        fontWeight: '500' as const,
      },
    });
  }

  /**
   * Styles pour ContainerContents - Interface Container Details
   */
  private static getContainerContentsStyles(theme: AppThemeType, common: CommonStyles) {
    const { width } = Dimensions.get('window');
    const isSmallScreen = width < 768; // Responsive breakpoint
    
    return StyleSheet.create({
      container: common.container,
      loadingContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        padding: 32,
      },
      loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: theme.text.secondary,
        textAlign: 'center' as const,
      },
      
      // ===== DESCRIPTION CONTAINER =====
      containerMeta: {
        backgroundColor: theme.surface,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      containerSubtitle: {
        fontSize: 14,
        color: theme.text.secondary,
        textAlign: 'center' as const,
      },
      containerActions: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 8,
      },
      headerActionButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: theme.background,
        borderWidth: 1,
        borderColor: theme.border,
      },
      editButton: {
        borderColor: theme.primary + '30',
        backgroundColor: theme.primary + '10',
      },
      deleteButton: {
        borderColor: theme.danger.main + '30',
        backgroundColor: theme.danger.main + '10',
      },
      
      // ===== LAYOUT RESPONSIVE =====
      columnsContainer: {
        flex: 1,
        flexDirection: isSmallScreen ? 'column' as const : 'row' as const,
        backgroundColor: theme.background,
      },
      columnWrapper: {
        flex: 1,
        marginHorizontal: isSmallScreen ? 0 : 4, // Réduit de 8 à 4 pour moins d'espace
        marginVertical: isSmallScreen ? 2 : 4,   // Réduit pour moins d'espace
        backgroundColor: theme.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.border,
      },
      columnHeader: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        backgroundColor: theme.background,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
      },
      columnTitle: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: theme.text.primary,
      },
      listContainer: {
        flex: 1,
        minHeight: isSmallScreen ? 200 : undefined, // Hauteur minimum sur mobile
      },
      
      // ===== RECHERCHE & FILTRES (Colonne 2 seulement) =====
      searchContainer: {
        paddingHorizontal: 16,
        paddingVertical: 6, // Réduit de 8 à 6
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      searchBox: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: theme.background,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6, // Réduit de 8 à 6
        borderWidth: 1,
        borderColor: theme.border,
      },
      searchIcon: {
        marginRight: 8,
      },
      searchInput: {
        flex: 1,
        fontSize: 16,
        color: theme.text.primary,
        padding: 0,
      },
      
      filtersContainer: {
        paddingHorizontal: 16,
        paddingBottom: 6, // Réduit de 8 à 6
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      filtersScrollView: {
        paddingVertical: 2, // Réduit de 4 à 2
      },
      filterPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: theme.background,
        borderRadius: 16,
        marginRight: 8,
        borderWidth: 1,
        borderColor: theme.border,
      },
      filterPillActive: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
      },
      filterPillText: {
        fontSize: 14,
        color: theme.text.primary,
        fontWeight: '500' as const,
      },
      filterPillTextActive: {
        color: theme.text.onPrimary,
      },
      
      // ===== CARDS D'ARTICLES =====
      articleCard: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        backgroundColor: theme.surface,
        borderLeftWidth: 3,
        borderLeftColor: theme.success + '60', // Bordure verte selon captures
      },
      articleImageContainer: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: theme.background,
        borderWidth: 1,
        borderColor: theme.border,
        overflow: 'hidden' as const,
      },
      articleImage: {
        width: '100%' as const,
        height: '100%' as const,
      },
      articleContent: {
        flex: 1,
      },
      articleName: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: theme.text.primary,
        marginBottom: 4,
      },
      articleDescription: {
        fontSize: 14,
        color: theme.text.secondary,
        marginBottom: 6,
        lineHeight: 18,
      },
      articleTags: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        marginBottom: 4,
      },
      articleTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: theme.background,
        borderRadius: 12,
        marginRight: 8,
        borderWidth: 1,
        borderColor: theme.border,
      },
      articleTagText: {
        fontSize: 12,
        color: theme.text.secondary,
        fontWeight: '500' as const,
      },
      articleTagContainer: {
        backgroundColor: theme.success + '20',
        borderColor: theme.success,
      },
      articleTagContainerText: {
        color: theme.success,
        fontWeight: '600' as const,
      },
      articlePrice: {
        fontSize: 14,
        fontWeight: '600' as const,
        color: theme.text.primary,
      },
      
      // ===== BOUTONS D'ACTION =====
      actionButtons: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 4,
      },
      actionIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        marginLeft: 4,
      },
      addIcon: {
        backgroundColor: theme.success + '20',
      },
      removeIcon: {
        backgroundColor: theme.danger.main + '20',
      },
      infoIcon: {
        backgroundColor: theme.text.secondary + '15',
      },
      
      // ===== ÉTATS VIDES =====
      emptyContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        paddingVertical: 32,
      },
      emptyText: {
        fontSize: 16,
        color: theme.text.secondary,
        textAlign: 'center' as const,
      },
      // Nouveaux styles pour les autres containers
      articleTagOtherContainer: {
        backgroundColor: theme.secondary + '20',
        borderColor: theme.secondary,
      },
      articleTagOtherContainerText: {
        color: theme.secondary,
        fontWeight: '600' as const,
      },
      noContainerTag: {
        backgroundColor: theme.danger.main + '20',
        borderColor: theme.danger.main,
      },
      noContainerTagText: {
        color: theme.danger.main,
        fontWeight: '600' as const,
      },
    });
  }

  /**
   * Styles pour Scanner
   */
  private static getScannerStyles(theme: AppThemeType, common: CommonStyles) {
    return StyleSheet.create({
      container: common.container,
      loadingContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
      },
      header: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        padding: 15,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        zIndex: 1,
      },
      headerTitle: {
        fontSize: 18,
        fontWeight: '700' as const,
      },
      modeButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        padding: 10,
        borderRadius: 8,
        gap: 8,
      },
      modeButtonText: {
        fontWeight: '600' as const,
        fontSize: 16,
      },
      helpButton: {
        padding: 8,
        borderRadius: 20,
      },
      scannerContainer: {
        flex: 1,
        backgroundColor: '#000',
      },
      cameraContainer: {
        flex: 1,
        position: 'relative' as const,
      },
      camera: {
        flex: 1,
      },
      overlay: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
      },
      scanArea: {
        position: 'absolute' as const,
        top: '25%',
        left: '15%',
        right: '15%',
        bottom: '25%',
        borderWidth: 2,
        borderColor: theme.primary,
        borderRadius: 12,
      },
      manualContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        padding: 20,
        backgroundColor: theme.background,
      },
      manualContentWrapper: {
        width: '100%',
        maxWidth: 400,
        alignItems: 'center' as const,
        padding: 30,
        borderRadius: 16,
        ...common.shadow,
      },
      comingSoonIcon: {
        marginBottom: 20,
      },
      comingSoonText: {
        fontSize: 20,
        fontWeight: '700' as const,
        textAlign: 'center' as const,
        marginBottom: 10,
      },
      comingSoonSubtext: {
        fontSize: 16,
        textAlign: 'center' as const,
        maxWidth: '80%',
        marginBottom: 20,
      },
      switchToScannerButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        padding: 10,
        borderRadius: 8,
        gap: 8,
      },
      switchToScannerText: {
        fontWeight: '600' as const,
        fontSize: 16,
      },
    });
  }

  /**
   * Styles pour Stats
   */
  private static getStatsStyles(theme: AppThemeType, common: CommonStyles) {
    return StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: theme.background,
      },
      loadingContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        backgroundColor: theme.background,
      },
      errorContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        padding: 20,
        backgroundColor: theme.background,
      },
      errorText: {
        color: theme.danger.main,
        fontSize: 16,
        textAlign: 'center' as const,
      },
      topBar: {
        height: Platform.OS === 'ios' ? 44 : 56,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 16,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      backButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        padding: 8,
        marginLeft: -8,
      },
      backButtonText: {
        fontSize: 17,
        color: theme.primary,
        marginLeft: -4,
      },
      content: {
        flex: 1,
        backgroundColor: theme.background,
      },
      section: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        backgroundColor: theme.background,
      },
      sectionTitle: {
        fontSize: 18,
        fontWeight: '600' as const,
        marginBottom: 16,
        color: theme.text.primary,
      },
      statRow: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
      },
      statItem: {
        flex: 1,
        alignItems: 'center' as const,
      },
      statValue: {
        fontSize: 24,
        fontWeight: '700' as const,
        color: theme.primary,
      },
      statLabel: {
        fontSize: 14,
        color: theme.text.secondary,
        marginTop: 4,
      },
      financialStats: {
        gap: 12,
        marginBottom: 16,
      },
      financialRow: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
      },
      financialLabel: {
        fontSize: 14,
        color: theme.text.secondary,
      },
      financialValue: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: theme.text.primary,
      },
      totalProfitLabel: {
        color: theme.text.primary,
        fontWeight: '600' as const,
      },
      totalProfitValue: {
        color: theme.success,
        fontSize: 18,
      },
      periodWrapper: {
        paddingHorizontal: 16,
        paddingBottom: 0,
        paddingTop: 16,
        width: '100%',
      },
      tooltipContainer: {
        backgroundColor: theme.surface,
        borderRadius: 8,
        padding: 12,
        marginHorizontal: 16,
        marginTop: 10,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: theme.border,
        ...Platform.select({
          web: {
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
          },
          default: {
            elevation: 3,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
          },
        }),
      },
      tooltipTitle: {
        fontSize: 16,
        fontWeight: '600' as const,
        marginBottom: 8,
        color: theme.text.primary,
        textAlign: 'center' as const,
      },
      tooltipRow: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        marginVertical: 4,
      },
      tooltipLabel: {
        fontSize: 14,
        color: theme.text.secondary,
      },
      tooltipValue: {
        fontSize: 15,
        fontWeight: '600' as const,
        color: theme.primary,
      },
      totalsContainer: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        padding: 16,
      },
      totalText: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: theme.text.primary,
      },
      loadingText: {
        fontSize: 16,
        color: theme.text.secondary,
      },
      noDataText: {
        fontSize: 16,
        color: theme.text.secondary,
      },
      categoryRow: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'flex-start' as const,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      categoryNameContainer: {
        flex: 1,
      },
      categoryName: {
        fontSize: 16,
        color: theme.text.primary,
        fontWeight: '600' as const,
      },
      itemCount: {
        fontSize: 12,
        color: theme.text.secondary,
        marginTop: 4,
      },
      categoryStats: {
        flex: 1,
        flexDirection: 'row' as const,
        justifyContent: 'flex-end' as const,
        gap: 16,
      },
      categoryStatItem: {
        alignItems: 'flex-end' as const,
      },
      categoryStatLabel: {
        fontSize: 12,
        color: theme.text.secondary,
        marginBottom: 4,
      },
      categoryValue: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: theme.primary,
      },
      categoryMargin: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: theme.success,
      },
      // Nouveaux styles pour les sections de performance
      performanceCard: {
        backgroundColor: theme.surface,
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.border,
        ...Platform.select({
          web: {
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
          },
          default: {
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
          },
        }),
      },
      performanceHeader: {
        marginBottom: 12,
      },
      performanceTitle: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: theme.text.primary,
      },
      performanceContent: {
        gap: 8,
      },
      performanceName: {
        fontSize: 18,
        fontWeight: '700' as const,
        color: theme.primary,
        marginBottom: 8,
      },
      performanceStats: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        gap: 16,
      },
      performanceProfit: {
        fontSize: 14,
        color: theme.text.primary,
        fontWeight: '500' as const,
      },
      performanceMargin: {
        fontSize: 14,
        color: theme.success,
        fontWeight: '500' as const,
      },
      averageRow: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        paddingVertical: 6,
      },
      averageLabel: {
        fontSize: 14,
        color: theme.text.secondary,
        flex: 1,
      },
      averageValue: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: theme.primary,
      },
      trendsContainer: {
        flexDirection: 'row' as const,
        justifyContent: 'space-around' as const,
        flexWrap: 'wrap' as const,
        gap: 12,
        marginBottom: 16,
      },
      comingSoonText: {
        fontSize: 14,
        color: theme.text.secondary,
        fontStyle: 'italic' as const,
        textAlign: 'center' as const,
        backgroundColor: theme.primary + '10',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.primary + '30',
      },
    });
  }

  /**
   * Styles pour FilterBar
   */
  private static getFilterBarStyles(theme: AppThemeType, common: CommonStyles) {
    return StyleSheet.create({
      container: {
        backgroundColor: theme.surface,
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      filterRow: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        marginBottom: 8,
      },
      filterButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.border,
        marginRight: 8,
      },
      filterButtonActive: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
      },
      filterButtonText: {
        ...common.text.secondary,
        fontSize: 12,
      },
      filterButtonTextActive: {
        color: theme.text.onPrimary,
      },
    });
  }

  /**
   * Styles pour Settings
   */
  private static getSettingsStyles(theme: AppThemeType, common: CommonStyles) {
    return StyleSheet.create({
      container: common.container,
      loadingContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        backgroundColor: theme.background,
      },
      loadingText: {
        marginTop: 8,
        fontSize: 16,
        color: theme.text.secondary,
      },
      topBar: {
        height: Platform.OS === 'ios' ? 44 : 56,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 10,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        justifyContent: 'space-between' as const,
      },
      backButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingVertical: 10,
        paddingHorizontal: 0,
        minWidth: Platform.OS === 'ios' ? 70 : 50,
        justifyContent: 'flex-start' as const,
      },
      backButtonText: {
        fontSize: 17,
        color: theme.primary,
        marginLeft: Platform.OS === 'ios' ? 6 : 0,
      },
      topBarTitle: {
        fontSize: 17,
        fontWeight: Platform.OS === 'ios' ? '600' as const : '500' as const,
        color: theme.text.primary,
        textAlign: 'center' as const,
        flex: 1,
        marginHorizontal: 10,
      },
      sectionContainer: {
        marginTop: 20,
        marginBottom: 10,
        paddingHorizontal: 16,
      },
      sectionTitle: {
        fontSize: 14,
        fontWeight: '600' as const,
        marginBottom: 12,
        color: theme.text.secondary,
      },
      themeButtonsContainer: {
        flexDirection: 'row' as const,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.border,
        overflow: 'hidden' as const,
      },
      themeButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        borderRightWidth: 1,
        borderRightColor: theme.border,
      },
      themeButtonLeft: {
        borderTopLeftRadius: 7,
        borderBottomLeftRadius: 7,
      },
      themeButtonRight: {
        borderTopRightRadius: 7,
        borderBottomRightRadius: 7,
        borderRightWidth: 0,
      },
      themeButtonText: {
        fontSize: 14,
        fontWeight: '500' as const,
      },
      menuItem: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        backgroundColor: theme.surface,
        borderBottomColor: theme.border,
      },
      menuText: {
        flex: 1,
        marginLeft: 16,
        fontSize: 16,
        color: theme.text.primary,
      },
      dangerItem: {
        marginTop: 24,
        borderTopWidth: 1,
        borderTopColor: theme.border,
      },
      dangerText: {
        color: theme.danger.main,
        fontWeight: '500' as const,
      },
    });
  }

  /**
   * Styles pour Labels
   */
  private static getLabelsStyles(theme: AppThemeType, common: CommonStyles) {
    return StyleSheet.create({
      safeArea: {
        flex: 1,
        backgroundColor: theme.background,
      },
      container: common.container,
      topBarContainer: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        paddingHorizontal: 10,
        height: Platform.OS === 'ios' ? 44 : 56,
        backgroundColor: theme.background,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.border,
      },
      backButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingVertical: 10,
        paddingHorizontal: 8,
        minWidth: Platform.OS === 'ios' ? 80 : 50,
        justifyContent: 'flex-start' as const,
      },
      backButtonText: {
        color: theme.primary,
        fontSize: 17,
        marginLeft: 5,
      },
      topBarTitle: {
        fontSize: 17,
        fontWeight: Platform.OS === 'ios' ? '600' as const : '500' as const,
        color: theme.text.primary,
        textAlign: 'center' as const,
        flexShrink: 1,
      },
      searchBarContainer: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: theme.surface,
        borderRadius: 8,
        paddingHorizontal: 12,
        marginHorizontal: 10,
        marginVertical: 8,
        height: 40,
      },
      searchIcon: {
        marginRight: 8,
      },
      searchInput: {
        fontSize: 16,
        color: theme.text.primary,
        height: '100%',
        flex: 1,
      },
      clearSearchButton: {
        padding: 4,
      },
      filtersSectionContainer: {
        paddingHorizontal: 10,
        marginBottom: 8,
      },
      filterDropdownsRow: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        marginBottom: 8,
      },
      dropdownWrapper: {
        flex: 1,
        marginHorizontal: 4,
      },
      filtersBar: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      filterTitle: {
        fontSize: 14,
        color: theme.text.secondary,
        marginRight: 8,
        alignSelf: 'center' as const,
      },
      priceInputsContainer: {
        flex: 1,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
      },
      priceInputWrapper: {
        flex: 1,
        maxWidth: '50%',
      },
      priceSeparator: {
        width: 12,
      },
      priceInput: {
        height: 38,
        width: '100%',
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 4,
        backgroundColor: theme.surface,
        fontSize: 14,
        color: theme.text.primary,
        paddingHorizontal: 10,
      },
      segmentContainer: {
        flexDirection: 'row' as const,
        backgroundColor: theme.surface,
        borderRadius: 8,
        marginHorizontal: 10,
        marginTop: 10,
      },
      tabButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        backgroundColor: theme.surface,
        borderRadius: 8,
      },
      tabButtonActive: {
        backgroundColor: theme.primary,
      },
      tabButtonText: {
        fontSize: 15,
        color: theme.text.primary,
        fontWeight: '500' as const,
      },
      tabButtonTextActive: {
        color: theme.text.onPrimary,
        fontWeight: 'bold' as const,
      },
      selectionHeader: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      selectionCountText: {
        fontSize: 14,
        color: theme.text.secondary,
        fontWeight: '500' as const,
      },
      selectionButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        marginLeft: 8,
      },
      selectionButtonText: {
        marginLeft: 4,
        fontSize: 14,
        color: theme.text.primary,
        fontWeight: '500' as const,
      },
      
      // ✅ AMÉLIORATION - Layout modernisé des items de liste
      itemRow: {
        backgroundColor: theme.surface,
        marginHorizontal: 12,
        marginVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.border,
        ...Platform.select({
          web: {
            boxShadow: `0 2px 8px ${theme.backdrop}20`,
          },
          default: {
            shadowColor: theme.backdrop,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
            elevation: 2,
          },
        }),
      },
      itemRowSelected: {
        borderColor: theme.primary,
        borderWidth: 2,
        backgroundColor: theme.primaryLight || theme.primary + '15',
        ...Platform.select({
          web: {
            boxShadow: `0 4px 16px ${theme.primary}30`,
          },
          default: {
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 6,
          },
        }),
      },
      
      itemContent: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        padding: 16,
      },
      
      itemTextContainer: {
        flex: 1,
        marginRight: 16,
      },
      
      itemHeader: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        marginBottom: 8,
      },
      
      itemIcon: {
        marginRight: 12,
        padding: 8,
        borderRadius: 8,
        backgroundColor: theme.surface,
      },
      
      itemIconSelected: {
        backgroundColor: theme.primary + '20',
      },
      
      itemName: {
        fontSize: 17,
        fontWeight: '600' as const,
        color: theme.text.primary,
        flex: 1,
        marginBottom: 2,
      },
      itemNameSelected: {
        color: theme.primary,
        fontWeight: '700' as const,
      },
      
      itemDetails: {
        marginTop: 6,
      },
      
      itemDescription: {
        fontSize: 14,
        color: theme.text.secondary,
        lineHeight: 18,
        marginBottom: 4,
      },
      itemDescriptionSelected: {
        color: theme.primary + 'CC',
      },
      
      itemMetaRow: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        marginTop: 6,
        flexWrap: 'wrap' as const,
      },
      
      itemMetaItem: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        marginRight: 16,
        marginBottom: 4,
      },
      
      itemMetaIcon: {
        marginRight: 4,
      },
      
      itemContainerName: {
        fontSize: 13,
        color: theme.text.secondary,
        fontWeight: '500' as const,
      },
      itemContainerNameSelected: {
        color: theme.primary + 'DD',
      },
      
      itemPrice: {
        fontSize: 15,
        color: theme.success || '#4CAF50',
        fontWeight: '600' as const,
      },
      itemPriceSelected: {
        color: theme.primary,
        fontWeight: '700' as const,
      },
      
      itemStatus: {
        fontSize: 12,
        fontWeight: '600' as const,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        backgroundColor: theme.surface,
        color: theme.text.secondary,
        overflow: 'hidden' as const,
      },
      
      itemStatusAvailable: {
        backgroundColor: '#E8F5E8',
        color: '#2E7D32',
      },
      
      itemStatusSold: {
        backgroundColor: '#FFF3E0',
        color: '#F57C00',
      },
      
      checkboxContainer: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: 'transparent',
      },
      
      checkboxContainerSelected: {
        backgroundColor: theme.primary + '20',
      },
      
      // Anciens styles conservés pour compatibilité
      itemInfo: {
        flex: 1,
        marginRight: 12,
      },
      
      footer: {
        position: 'absolute' as const,
        bottom: 0,
        left: 0,
        right: 0,
        padding: Platform.OS === 'ios' ? 20 : 16,
        paddingBottom: Platform.OS === 'ios' ? 30 : 16,
        backgroundColor: theme.surface,
        borderTopWidth: 1,
        borderTopColor: theme.border,
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
      },
      clearAllButton: {
        backgroundColor: 'transparent',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 8,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        flexDirection: 'row' as const,
        borderWidth: 1,
        borderColor: theme.primary,
        marginRight: 10,
        flex: 1,
      },
      clearAllButtonText: {
        color: theme.primary,
        fontSize: 15,
        fontWeight: '500' as const,
      },
      generateButton: {
        backgroundColor: theme.primary,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        flexDirection: 'row' as const,
        flex: 1,
      },
      generateButtonText: {
        color: theme.text.onPrimary,
        fontSize: 16,
        fontWeight: 'bold' as const,
      },
      buttonIcon: {
        marginRight: 8,
      },
      loadingContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        padding: 20,
        backgroundColor: theme.background,
      },
      loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: theme.text.secondary,
      },
      noResultsContainer: {
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        padding: 20,
        marginTop: 50,
        backgroundColor: theme.surface,
      },
      noResultsText: {
        fontSize: 16,
        color: theme.text.secondary,
        textAlign: 'center' as const,
        lineHeight: 24,
        marginTop: 8,
      },
      
      dateFiltersContainer: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        paddingHorizontal: 4,
        paddingVertical: 8,
      },
      datePickerWrapper: {
        flex: 1,
        marginHorizontal: 4,
      },
      dateButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        height: 38,
      },
      dateButtonContentView: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        flex: 1,
      },
      dateButtonIcon: {
        marginRight: 8,
      },
      dateButtonTextValue: {
        flex: 1,
        fontSize: 14,
        color: theme.text.primary,
      },
      dateClearButton: {
        padding: 4,
        marginLeft: 8,
      },
      
      filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        marginRight: 8,
      },
      filterChipActive: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
      },
      filterChipText: {
        fontSize: 14,
        color: theme.text.secondary,
        fontWeight: '500' as const,
      },
      filterChipTextActive: {
        color: theme.text.onPrimary,
        fontWeight: '600' as const,
      },
      
      listContentContainer: {
        paddingBottom: 100,
      },
      centeredLoading: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        padding: 40,
      },
    });
  }

  /**
   * Styles pour MultiReceipt
   */
  private static getMultiReceiptStyles(theme: AppThemeType, common: CommonStyles) {
    return StyleSheet.create({
      container: common.container,
      topBar: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: theme.surface,
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 50 : 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      backButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
      },
      backButtonText: {
        fontSize: 16,
        marginLeft: 4,
        color: theme.primary,
      },
      topBarTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '600' as const,
        textAlign: 'center' as const,
        marginRight: 40,
        color: theme.text.primary,
      },
      searchArea: {
        padding: 12,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      searchBoxContainer: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: theme.background,
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 44,
        borderWidth: 1,
        borderColor: theme.border,
      },
      searchIcon: {
        marginRight: 8,
      },
      searchBoxInput: {
        flex: 1,
        height: '100%' as const,
        fontSize: 16,
        color: theme.text.primary,
      },
      clearButton: {
        padding: 6,
      },
      selectedItemsContainer: {
        backgroundColor: theme.surface,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      selectedItemsHeader: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 16,
        marginBottom: 8,
      },
      selectedItemsTitle: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: theme.text.primary,
      },
      clearSelectionButton: {
        paddingVertical: 4,
        paddingHorizontal: 8,
      },
      clearSelectionText: {
        fontSize: 14,
        color: theme.primary,
      },
      selectedItemsScrollView: {
        paddingLeft: 12,
      },
      selectedItemCard: {
        width: 140,
        backgroundColor: theme.background,
        marginRight: 8,
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: theme.border,
      },
      selectedItemHeader: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        marginBottom: 8,
      },
      selectedItemName: {
        fontSize: 14,
        fontWeight: '500' as const,
        flex: 1,
        marginRight: 4,
        color: theme.text.primary,
      },
      selectedItemPrice: {
        fontSize: 14,
        fontWeight: '600' as const,
        color: theme.success,
        marginBottom: 8,
      },
      priceControl: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: theme.surface,
        borderRadius: 4,
        paddingVertical: 6,
        paddingHorizontal: 8,
        marginVertical: 6,
      },
      priceLabel: {
        fontSize: 13,
        marginRight: 8,
        color: theme.text.secondary,
      },
      priceInput: {
        width: 55,
        backgroundColor: theme.surface,
        borderRadius: 4,
        paddingHorizontal: 3,
        paddingVertical: 4,
        fontSize: 13,
        textAlign: 'left' as const,
        marginHorizontal: 4,
        borderWidth: 1,
        borderColor: theme.border,
        color: theme.text.primary,
      },
      priceUnit: {
        marginLeft: 0,
        fontSize: 13,
        color: theme.text.secondary,
      },
      itemDiscountContainer: {
        backgroundColor: theme.danger.background || theme.danger.main + '20',
        borderRadius: 4,
        paddingVertical: 4,
        paddingHorizontal: 6,
        marginTop: 2,
      },
      itemDiscountText: {
        fontSize: 11,
        color: theme.danger.main,
        textAlign: 'center' as const,
      },
      discountControlContainer: {
        backgroundColor: theme.background,
        padding: 12,
        borderRadius: 8,
        marginTop: 12,
        marginHorizontal: 16,
        borderWidth: 1,
        borderColor: theme.border,
      },
      discountControlLabel: {
        fontSize: 14,
        fontWeight: '500' as const,
        marginBottom: 8,
        color: theme.text.primary,
      },
      discountInputRow: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
      },
      discountInput: {
        flex: 1,
        backgroundColor: theme.surface,
        borderRadius: 4,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 14,
        borderWidth: 1,
        borderColor: theme.border,
        marginRight: 8,
        color: theme.text.primary,
      },
      applyDiscountButton: {
        backgroundColor: theme.primary,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 4,
      },
      applyDiscountText: {
        color: theme.text.onPrimary,
        fontSize: 14,
        fontWeight: '500' as const,
      },
      totalDiscountText: {
        fontSize: 13,
        color: theme.danger.main,
        marginTop: 8,
        textAlign: 'right' as const,
      },
      generateReceiptButton: {
        flexDirection: 'row' as const,
        backgroundColor: theme.primary,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        marginTop: 12,
        marginHorizontal: 16,
      },
      buttonIcon: {
        marginRight: 8,
      },
      generateReceiptText: {
        color: theme.text.onPrimary,
        fontSize: 16,
        fontWeight: '600' as const,
      },
      confirmationOverlay: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        zIndex: 1000,
      },
      confirmationDialog: {
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: 20,
        width: '85%' as const,
        maxWidth: 400,
        alignItems: 'center' as const,
        ...Platform.select({
          web: {
            boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
          },
          default: {
            elevation: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 6,
          },
        }),
      },
      confirmationTitle: {
        fontSize: 18,
        fontWeight: '600' as const,
        marginBottom: 12,
        textAlign: 'center' as const,
        color: theme.text.primary,
      },
      confirmationText: {
        fontSize: 14,
        textAlign: 'center' as const,
        marginBottom: 20,
        lineHeight: 20,
        color: theme.text.secondary,
      },
      confirmationButtons: {
        flexDirection: 'row' as const,
        width: '100%' as const,
        justifyContent: 'space-between' as const,
      },
      confirmationButtonLeft: {
        flex: 1,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 8,
        paddingVertical: 12,
        marginRight: 8,
        alignItems: 'center' as const,
      },
      confirmationButtonRight: {
        flex: 1,
        backgroundColor: theme.primary,
        borderRadius: 8,
        paddingVertical: 12,
        marginLeft: 8,
        alignItems: 'center' as const,
      },
      confirmationButtonTextLeft: {
        fontSize: 16,
        fontWeight: '500' as const,
        color: theme.text.primary,
      },
      confirmationButtonTextRight: {
        fontSize: 16,
        fontWeight: '500' as const,
        color: theme.text.onPrimary,
      },
      searchResultsContainer: {
        flex: 1,
        backgroundColor: theme.background,
      },
      searchResultsTitle: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: theme.text.primary,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      searchResultsList: {
        flex: 1,
      },
      searchResultsContent: {
        paddingBottom: 16,
      },
      searchResultItem: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: theme.surface,
        marginHorizontal: 12,
        marginVertical: 4,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.border,
        ...Platform.select({
          web: {
            boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
          },
          default: {
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
          },
        }),
      },
      selectedItem: {
        borderColor: theme.primary,
        borderWidth: 2,
        backgroundColor: theme.primaryLight || theme.primary + '10',
      },
      itemImageContainer: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: theme.border + '40',
        marginRight: 12,
        overflow: 'hidden' as const,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
      },
      itemImage: {
        width: '100%' as const,
        height: '100%' as const,
        borderRadius: 8,
      },
      noImagePlaceholder: {
        width: '100%' as const,
        height: '100%' as const,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        backgroundColor: theme.border + '20',
      },
      itemDetails: {
        flex: 1,
        marginRight: 8,
      },
      itemName: {
        fontSize: 16,
        fontWeight: '500' as const,
        color: theme.text.primary,
        marginBottom: 4,
      },
      itemDescription: {
        fontSize: 14,
        color: theme.text.secondary,
        marginBottom: 4,
      },
      itemPrice: {
        fontSize: 14,
        fontWeight: '600' as const,
        color: theme.success,
      },
      selectionIndicator: {
        paddingLeft: 8,
      },
      emptyResultsContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        padding: 40,
      },
      emptyResultsText: {
        fontSize: 16,
        color: theme.text.secondary,
        textAlign: 'center' as const,
        marginTop: 12,
      },
      startSearchContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        padding: 40,
      },
      startSearchText: {
        fontSize: 16,
        color: theme.text.secondary,
        textAlign: 'center' as const,
        marginTop: 12,
      },
      loadingContainer: {
        padding: 20,
        alignItems: 'center' as const,
      },
      loadingText: {
        marginTop: 8,
        fontSize: 14,
        color: theme.text.secondary,
      },
    });
  }

  /**
   * Styles pour CommonHeader - Standards unifiés pour tous les headers
   */
  private static getCommonHeaderStyles(theme: AppThemeType, common: CommonStyles) {
    return StyleSheet.create({
      topBar: {
        height: Platform.OS === 'ios' ? 44 : 56,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 10,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        justifyContent: 'space-between' as const,
      },
      
      topBarTitle: {
        fontSize: 17,
        fontWeight: Platform.OS === 'ios' ? '600' as const : '500' as const,
        color: theme.text.primary,
        textAlign: 'center' as const,
        flex: 1,
        marginHorizontal: 10,
      },
      
      backButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingVertical: 10,
        paddingHorizontal: Platform.OS === 'ios' ? 0 : 8,
        minWidth: Platform.OS === 'ios' ? 70 : 50,
        justifyContent: 'flex-start' as const,
      },
      
      backButtonText: {
        fontSize: 17,
        color: theme.primary,
        marginLeft: Platform.OS === 'ios' ? 6 : 4,
      },
      
      backIcon: {
        // Styles pour l'icône directement dans les composants
      },
      
      headerSection: {
        padding: 16,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      
      pageTitle: {
        fontSize: 28,
        fontWeight: '700' as const,
        color: theme.text.primary,
        marginBottom: 16,
      },
      
      pageSubtitle: {
        fontSize: 16,
        color: theme.text.secondary,
        marginBottom: 12,
      },
      
      headerActions: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 12,
      },
      
      headerActionButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: theme.primary,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        marginHorizontal: 16,
        marginVertical: 8,
        ...Platform.select({
          web: {
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
          },
          default: {
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
          },
        }),
      },
      
      headerActionText: {
        color: theme.text.onPrimary,
        fontSize: 16,
        fontWeight: '600' as const,
        marginLeft: 8,
      },
      
      modalHeader: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        padding: 16,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      
      modalTitle: {
        fontSize: 18,
        fontWeight: '600' as const,
        color: theme.text.primary,
      },
      
      modalCloseButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: theme.surface,
      },
      
      cancelButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingVertical: 8,
        paddingHorizontal: 12,
      },
      
      cancelButtonText: {
        color: theme.primary,
        fontSize: 16,
        fontWeight: '500' as const,
      },
      
      confirmButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: theme.primary,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
      },
      
      confirmButtonText: {
        color: theme.text.onPrimary,
        fontSize: 16,
        fontWeight: '600' as const,
      },
      
      searchHeader: {
        backgroundColor: theme.surface,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      
      searchInput: {
        backgroundColor: theme.background,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'web' ? 8 : 6,
        fontSize: 16,
        color: theme.text.primary,
      },
      
      loadingContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        backgroundColor: theme.background,
      },
      
      loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: theme.text.secondary,
      },
      
      errorContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        padding: 20,
        backgroundColor: theme.background,
      },
      
      errorTitle: {
        fontSize: 20,
        fontWeight: '600' as const,
        color: theme.text.primary,
        marginTop: 16,
        marginBottom: 8,
      },
      
      errorText: {
        color: theme.danger.main,
        fontSize: 16,
        textAlign: 'center' as const,
        marginBottom: 16,
      },
      
      errorButton: {
        backgroundColor: theme.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
      },
      
      errorButtonText: {
        color: theme.text.onPrimary,
        fontSize: 16,
        fontWeight: '600' as const,
      },
      
      headerSpacer: {
        width: 70,
      },
      
      flexSpacer: {
        flex: 1,
      },
      
      breadcrumbContainer: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: theme.background,
      },
      
      breadcrumbItem: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
      },
      
      breadcrumbText: {
        fontSize: 14,
        color: theme.text.secondary,
      },
      
      breadcrumbSeparator: {
        marginHorizontal: 8,
        color: theme.text.disabled,
      },
      
      tabsContainer: {
        flexDirection: 'row' as const,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      
      tabButton: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center' as const,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
      },
      
      tabButtonActive: {
        borderBottomColor: theme.primary,
      },
      
      tabButtonText: {
        fontSize: 16,
        color: theme.text.secondary,
        fontWeight: '500' as const,
      },
      
      tabButtonTextActive: {
        color: theme.primary,
        fontWeight: '600' as const,
      },
    });
  }
}

export default StyleFactory; 