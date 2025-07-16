import { StyleSheet, Platform, ImageResizeMode, Dimensions } from 'react-native';
import type { AppThemeType } from '../contexts/ThemeContext';
import { PlatformUtils } from '../utils/platformUtils';

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
  | 'LocationCard'
  | 'Scanner'
  | 'Stats'
  | 'SalesChart'
  | 'FilterBar'
  | 'Settings'
  | 'Labels'
  | 'MultiReceipt'
  | 'CommonHeader'
  | 'Common'
  | 'ExportButtons'
  | 'SourcesScreen'
  | 'AddSourceScreen'
  | 'SourceDetailScreen';

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
      case 'LocationCard':
        return this.getLocationCardStyles(theme, commonStyles);
      case 'Scanner':
        return this.getScannerStyles(theme, commonStyles);
      case 'Stats':
        return this.getStatsStyles(theme, commonStyles);
      case 'SalesChart':
        return this.getSalesChartStyles(theme, commonStyles);
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
      case 'ExportButtons':
        return this.getExportButtonsStyles(theme, commonStyles);
      case 'SourcesScreen':
        return this.getSourcesScreenStyles(theme, commonStyles);
      case 'AddSourceScreen':
        return this.getAddSourceScreenStyles(theme, commonStyles);
      case 'SourceDetailScreen':
        return this.getSourceDetailScreenStyles(theme, commonStyles);
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
  private static getLocationCardStyles(theme: AppThemeType, common: CommonStyles) {
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
      address: {
        ...common.text.secondary,
        fontSize: 13,
        fontStyle: 'italic' as const,
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
      
      // ===== LOCATION GRID =====
      grid: {
        padding: 8,
        flexGrow: 1,
      },
      gridRow: {
        justifyContent: 'space-between' as const,
        marginBottom: 8,
      },
      locationCard: {
        flex: 0.48, // 48% de largeur pour 2 colonnes avec espace
        aspectRatio: 1.3, // Ratio légèrement rectangulaire pour plus de contenu
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: 16,
        marginVertical: 4,
        borderWidth: 1,
        borderColor: theme.border,
        justifyContent: 'space-between' as const,
        minHeight: 130,
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
      locationName: {
        fontSize: 16,
        fontWeight: '700' as const,
        marginBottom: 4,
        color: theme.text.primary,
      },
      locationAddress: {
        fontSize: 13,
        color: theme.text.secondary,
        marginBottom: 8,
        fontStyle: 'italic' as const,
      },
      statsContainer: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        marginTop: 'auto' as const,
      },
      statItem: {
        alignItems: 'center' as const,
      },
      statNumber: {
        fontSize: 16,
        fontWeight: '700' as const,
        color: theme.primary,
      },
      statLabel: {
        fontSize: 11,
        color: theme.text.secondary,
        marginTop: 2,
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
      
      // Styles pour l'assignation de containers
      sectionHeader: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        marginBottom: 12,
      },
      addButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.primary,
        backgroundColor: 'transparent',
      },
      addButtonText: {
        fontSize: 14,
        fontWeight: '600' as const,
        marginLeft: 4,
      },
      emptyText: {
        fontSize: 14,
        color: theme.text.secondary,
        textAlign: 'center' as const,
        paddingVertical: 16,
        fontStyle: 'italic' as const,
      },
      section: {
        marginBottom: 20,
      },
      sectionTitle: {
        fontSize: 18,
        fontWeight: '600' as const,
        color: theme.text.primary,
        marginBottom: 12,
      },
      checkbox: {
        width: 24,
        height: 24,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: theme.border,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
      },
      removeButton: {
        padding: 4,
        borderRadius: 4,
      },
      headerButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
      },
    });
  }

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
   * Styles pour Scanner - Version moderne et complète
   */
  private static getScannerStyles(theme: AppThemeType, common: CommonStyles) {
    const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
    const SCANNER_SIZE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.7;
    
    return StyleSheet.create({
      // ===== CONTENEURS PRINCIPAUX =====
      container: {
        flex: 1,
        backgroundColor: '#000',
      },
      centerContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        padding: 20,
        backgroundColor: '#000',
      },
      
      // ===== PERMISSIONS ET ÉTATS =====
      permissionContainer: {
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        flex: 1,
        padding: 32,
      },
      permissionIcon: {
        marginBottom: 24,
        padding: 20,
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.1)',
      },
      permissionTitle: {
        fontSize: 24,
        fontWeight: '700' as const,
        color: '#fff',
        textAlign: 'center' as const,
        marginBottom: 12,
      },
      permissionText: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center' as const,
        lineHeight: 24,
        marginBottom: 32,
        maxWidth: 300,
      },
      permissionButton: {
        backgroundColor: theme.primary,
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 12,
        minWidth: 200,
        marginVertical: 8,
        elevation: 8,
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      permissionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600' as const,
        textAlign: 'center' as const,
      },
      cancelButton: {
        backgroundColor: 'rgba(255,59,48,0.9)',
        borderWidth: 1,
        borderColor: '#FF3B30',
      },
      retryButton: {
        backgroundColor: 'rgba(255,149,0,0.9)',
        borderWidth: 1,
        borderColor: '#FF9500',
      },
      
      // ===== OVERLAY ET HEADER =====
      overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'space-between' as const,
      },
      header: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        padding: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 30,
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
      },
             headerButton: {
         padding: 12,
         backgroundColor: 'rgba(255,255,255,0.15)',
         borderRadius: 12,
         borderWidth: 1,
         borderColor: 'rgba(255,255,255,0.2)',
       },
      modeIndicator: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: 'rgba(0,0,0,0.8)',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        gap: 10,
      },
      modeText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600' as const,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      },
      
      // ===== ZONE DE SCAN =====
      scannerFrame: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
      },
      scannerContainer: {
        width: SCANNER_SIZE,
        height: SCANNER_SIZE,
        position: 'relative' as const,
      },
      scannerContainerSplit: {
        width: SCANNER_SIZE * 0.8,
        height: SCANNER_SIZE * 0.8,
        position: 'relative' as const,
        marginBottom: 20,
      },
      scanner: {
        width: '100%' as const,
        height: '100%' as const,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.8)',
        borderRadius: 24,
        position: 'relative' as const,
        overflow: 'hidden' as const,
      },
      scannerCorner: {
        position: 'absolute' as const,
        width: 24,
        height: 24,
        borderColor: theme.primary,
        borderWidth: 4,
      },
      topLeft: {
        top: -3,
        left: -3,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        borderTopLeftRadius: 24,
      },
      topRight: {
        top: -3,
        right: -3,
        borderLeftWidth: 0,
        borderBottomWidth: 0,
        borderTopRightRadius: 24,
      },
      bottomLeft: {
        bottom: -3,
        left: -3,
        borderRightWidth: 0,
        borderTopWidth: 0,
        borderBottomLeftRadius: 24,
      },
      bottomRight: {
        bottom: -3,
        right: -3,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        borderBottomRightRadius: 24,
      },
      scanLine: {
        position: 'absolute' as const,
        left: 0,
        width: '100%' as const,
        height: 3,
        backgroundColor: theme.primary,
        borderRadius: 2,
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      
      // ===== FEEDBACK VISUEL =====
      successOverlay: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        backgroundColor: 'rgba(76,175,80,0.2)',
        borderRadius: 24,
      },
      scanInstruction: {
        position: 'absolute' as const,
        bottom: -60,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center' as const,
      },
      instructionText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500' as const,
        textAlign: 'center' as const,
      },
      
      // ===== DIALOGUES DE CONFIRMATION =====
      confirmationWrapper: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        backgroundColor: 'rgba(0,0,0,0.8)',
      },
             confirmationContainer: {
         backgroundColor: 'rgba(28,28,30,0.95)',
         borderRadius: 20,
         padding: 28,
         alignItems: 'center' as const,
         width: '90%' as const,
         maxWidth: 420,
         borderWidth: 1,
         borderColor: 'rgba(255,255,255,0.1)',
         elevation: 10,
         shadowColor: '#000',
         shadowOffset: { width: 0, height: 8 },
         shadowOpacity: 0.4,
         shadowRadius: 16,
       },
      confirmationHeader: {
        alignItems: 'center' as const,
        marginBottom: 20,
        gap: 16,
      },
      confirmationIcon: {
        padding: 16,
        borderRadius: 50,
        backgroundColor: 'rgba(76,175,80,0.2)',
      },
      confirmationTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '700' as const,
        textAlign: 'center' as const,
        marginBottom: 8,
      },
      confirmationText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 16,
        textAlign: 'center' as const,
        lineHeight: 24,
        marginBottom: 8,
      },
      confirmationSubtext: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        textAlign: 'center' as const,
        fontStyle: 'italic' as const,
        marginBottom: 24,
      },
      
      // ===== BOUTONS =====
      buttonGroup: {
        flexDirection: 'row' as const,
        gap: 12,
        width: '100%' as const,
        justifyContent: 'center' as const,
        flexWrap: 'wrap' as const,
      },
      button: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
        minWidth: 120,
        justifyContent: 'center' as const,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      buttonPrimary: {
        backgroundColor: theme.primary,
        borderWidth: 1,
        borderColor: theme.primary,
      },
      buttonSecondary: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
      },
      buttonDanger: {
        backgroundColor: 'rgba(255,59,48,0.9)',
        borderWidth: 1,
        borderColor: '#FF3B30',
      },
      buttonWarning: {
        backgroundColor: 'rgba(255,149,0,0.9)',
        borderWidth: 1,
        borderColor: '#FF9500',
      },
      buttonText: {
        fontSize: 15,
        fontWeight: '600' as const,
        textAlign: 'center' as const,
      },
      buttonTextPrimary: {
        color: '#fff',
      },
      buttonTextSecondary: {
        color: '#fff',
      },
      
      // ===== LISTE D'ARTICLES =====
      splitContainer: {
        flex: 1,
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
      },
      scannerColumn: {
        width: '48%' as const,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        paddingLeft: 10,
      },
      listColumn: {
        width: '48%' as const,
        backgroundColor: 'rgba(0,0,0,0.9)',
        borderTopLeftRadius: 20,
        borderBottomLeftRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
      },
      containerInfo: {
        alignItems: 'center' as const,
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 20,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
      },
      containerInfoSplit: {
        alignItems: 'center' as const,
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 16,
        borderRadius: 16,
        width: '100%' as const,
        maxWidth: 280,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
      },
      containerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700' as const,
        marginBottom: 6,
        textAlign: 'center' as const,
      },
      itemCount: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        textAlign: 'center' as const,
      },
      
      // ===== LISTE DES ARTICLES SCANNÉS =====
      listHeader: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        marginBottom: 12,
        paddingHorizontal: 4,
        gap: 10,
      },
      listHeaderText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600' as const,
      },
      scannedItemsContainer: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        overflow: 'hidden' as const,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        flex: 1, // ✅ AJOUT: Permet au container de prendre tout l'espace disponible
      },
      scannedItemsList: {
        // ✅ CORRECTION: Suppression de maxHeight pour permettre le scroll complet
        flex: 1, // Prend tout l'espace disponible dans le container
        paddingVertical: 4, // Petit padding pour l'amélioration UX
      },
      scannedItem: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginVertical: 2,
        marginHorizontal: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
      },
      itemSeparator: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginHorizontal: 16,
      },
      scannedItemInfo: {
        flex: 1,
        marginRight: 12,
      },
      scannedItemName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600' as const,
        marginBottom: 4,
      },
      scannedItemPrice: {
        color: theme.success || '#4CAF50',
        fontSize: 14,
        fontWeight: '500' as const,
        marginBottom: 2,
      },
      scannedItemTime: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        fontStyle: 'italic' as const,
      },
      removeItemButton: {
        padding: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(255,59,48,0.2)',
        borderWidth: 1,
        borderColor: 'rgba(255,59,48,0.4)',
      },
      
      // ===== ACTIONS =====
      finishButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        backgroundColor: theme.success || '#4CAF50',
        padding: 16,
        margin: 16,
        borderRadius: 16,
        gap: 10,
        elevation: 6,
        shadowColor: theme.success || '#4CAF50',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      finishButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700' as const,
      },
      
      // ===== PROGRESSION =====
      progressContainer: {
        alignItems: 'center' as const,
        padding: 20,
      },
      progressBarContainer: {
        width: '100%' as const,
        height: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 4,
        marginVertical: 20,
        overflow: 'hidden' as const,
      },
      progressBar: {
        height: '100%' as const,
        backgroundColor: theme.primary,
        borderRadius: 4,
      },
      progressText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600' as const,
        marginBottom: 12,
      },
      progressSubtext: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        textAlign: 'center' as const,
      },
      
      // ===== ÉTATS VIDES =====
      emptyState: {
        padding: 32,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        flex: 1,
      },
      emptyStateIcon: {
        marginBottom: 16,
        padding: 20,
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.1)',
      },
      emptyStateText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 16,
        textAlign: 'center' as const,
        lineHeight: 24,
        maxWidth: 250,
      },
      
      // ===== LOADING =====
      loadingContainer: {
        alignItems: 'center' as const,
        padding: 32,
      },
      loadingText: {
        color: '#fff',
        fontSize: 16,
        marginTop: 16,
        textAlign: 'center' as const,
      },
      loadingSubtext: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center' as const,
      },
      
      // ===== ERREURS =====
      errorContainer: {
        alignItems: 'center' as const,
        padding: 32,
      },
      errorIcon: {
        marginBottom: 16,
        padding: 20,
        borderRadius: 50,
        backgroundColor: 'rgba(255,59,48,0.2)',
      },
      errorTitle: {
        color: '#FF3B30',
        fontSize: 20,
        fontWeight: '700' as const,
        marginBottom: 12,
        textAlign: 'center' as const,
      },
      errorText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 16,
        textAlign: 'center' as const,
        lineHeight: 24,
        marginBottom: 24,
        maxWidth: 300,
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
        padding: 16,
        backgroundColor: theme.surface,
        borderRadius: 8,
        marginTop: 8,
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
      // 🆕 NOUVEAUX STYLES pour les statistiques de période
      periodStatsRow: {
        flexDirection: 'row' as const,
        justifyContent: 'space-around' as const,
        alignItems: 'center' as const,
        marginBottom: 8,
      },
      periodStatItem: {
        flex: 1,
        alignItems: 'center' as const,
        paddingVertical: 8,
      },
      periodStatLabel: {
        fontSize: 12,
        color: theme.text.secondary,
        marginBottom: 4,
        textAlign: 'center' as const,
        fontWeight: '500' as const,
      },
      periodStatValue: {
        fontSize: 18,
        fontWeight: '700' as const,
        color: theme.primary,
        textAlign: 'center' as const,
      },
      
      // 🆕 NOUVEAUX STYLES pour SalesBarChart
      salesChartContainer: {
        backgroundColor: theme.surface,
        borderRadius: 16,
        margin: 16,
        borderWidth: 1,
        borderColor: theme.border,
        ...Platform.select({
          web: {
            boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
          },
          default: {
            elevation: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 6,
          },
        }),
      },
      salesChartHeader: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      salesChartTitleRow: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        marginBottom: 12,
      },
      salesChartTitle: {
        fontSize: 18,
        fontWeight: '600' as const,
        color: theme.text.primary,
      },
      salesPeriodSelectors: {
        flexDirection: 'row' as const,
        gap: 8,
      },
      salesPeriodText: {
        fontSize: 12,
        color: theme.text.secondary,
        backgroundColor: theme.backgroundSecondary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
      },
      salesTotalContainer: {
        alignItems: 'center' as const,
        marginVertical: 16,
      },
      salesTotalAmount: {
        fontSize: 32,
        fontWeight: '700' as const,
        color: theme.text.primary,
        marginBottom: 4,
      },
      salesTotalPeriod: {
        fontSize: 14,
        color: theme.text.secondary,
      },
      salesNavigation: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        marginTop: 16,
      },
      salesNavButton: {
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: theme.backgroundSecondary,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        borderWidth: 1,
        borderColor: theme.border,
        minWidth: 60,
      },
      salesNavButtonDisabled: {
        opacity: 0.4,
        backgroundColor: theme.border,
      },
      salesNavCenter: {
        flex: 1,
        alignItems: 'center' as const,
        paddingHorizontal: 16,
      },
      salesNavDate: {
        fontSize: 14,
        fontWeight: '500' as const,
        color: theme.text.primary,
        textAlign: 'center' as const,
      },
      salesChartContent: {
        paddingHorizontal: 16,
        paddingVertical: 20,
        minHeight: 250,
      },
      chartWrapper: {
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
      },
      salesLegend: {
        flexDirection: 'row' as const,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderTopColor: theme.border,
      },
      salesLegendItem: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 8,
      },
      salesLegendColor: {
        width: 12,
        height: 12,
        borderRadius: 6,
      },
      salesLegendText: {
        fontSize: 12,
        color: theme.text.secondary,
        fontWeight: '500' as const,
      },
      
      // 🆕 NOUVEAUX STYLES pour navigation avancée
      salesNavigationExtended: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        marginTop: 16,
        paddingHorizontal: 4,
        gap: 8,
      },
      salesNavButtonFast: {
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 14,
        backgroundColor: theme.primary,
        borderWidth: 1,
        borderColor: theme.primary,
        minWidth: 70,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
      },
      salesNavButtonFastText: {
        fontSize: 11,
        fontWeight: '600' as const,
        color: theme.text.onPrimary,
        textAlign: 'center' as const,
      },
      salesNavButtonText: {
        fontSize: 11,
        fontWeight: '500' as const,
        color: theme.text.primary,
        textAlign: 'center' as const,
      },
      salesNavButtonTextDisabled: {
        color: theme.text.disabled,
      },
      salesTodayButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: theme.success,
        borderWidth: 1,
        borderColor: theme.success,
        flex: 1,
        maxWidth: 100,
      },
      salesTodayButtonDisabled: {
        backgroundColor: theme.border,
        borderColor: theme.border,
      },
      salesTodayButtonText: {
        fontSize: 12,
        fontWeight: '600' as const,
        color: 'white',
        textAlign: 'center' as const,
      },
      salesTodayButtonTextDisabled: {
        color: theme.text.disabled,
      },
      salesInfoText: {
        fontSize: 12,
        color: theme.text.secondary,
        textAlign: 'center' as const,
        marginTop: 4,
      },
      
      // 🆕 STYLES pour le tooltip de détail du jour
      dayDetailTooltip: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        zIndex: 1000,
      },
      dayDetailContent: {
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 24,
        marginHorizontal: 40,
        borderWidth: 1,
        borderColor: theme.border,
        alignItems: 'center' as const,
        minWidth: 280,
        ...Platform.select({
          web: {
            boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.2)',
          },
          default: {
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
          },
        }),
      },
      dayDetailClose: {
        position: 'absolute' as const,
        top: 12,
        right: 12,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: theme.border,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
      },
      dayDetailCloseText: {
        fontSize: 14,
        color: theme.text.secondary,
        fontWeight: '600' as const,
      },
      dayDetailDate: {
        fontSize: 18,
        fontWeight: '600' as const,
        color: theme.text.primary,
        marginBottom: 16,
        textAlign: 'center' as const,
        textTransform: 'capitalize' as const,
      },
      dayDetailAmount: {
        fontSize: 32,
        fontWeight: '700' as const,
        color: theme.primary,
        marginBottom: 8,
        textAlign: 'center' as const,
      },
      dayDetailLabel: {
        fontSize: 14,
        color: theme.text.secondary,
        marginBottom: 16,
        textAlign: 'center' as const,
      },
      dayDetailNoSales: {
        fontSize: 14,
        color: theme.text.disabled,
        fontStyle: 'italic' as const,
        textAlign: 'center' as const,
      },
      salesClickHint: {
        fontSize: 11,
        color: theme.text.secondary,
        textAlign: 'center' as const,
        marginTop: 8,
        fontStyle: 'italic' as const,
      },
      
      totalText: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: theme.text.primary,
      },
      loadingText: {
        fontSize: 16,
        color: theme.text.secondary,
        textAlign: 'center' as const,
      },
      noDataText: {
        fontSize: 14,
        color: theme.text.secondary,
        textAlign: 'center' as const,
        fontStyle: 'italic' as const,
        marginTop: 8,
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
      // 🆕 STYLES pour les nouvelles sections d'articles
      stockStatsContainer: {
        backgroundColor: theme.surface,
        borderRadius: 8,
        padding: 16,
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
      stockStatRow: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        marginBottom: 12,
      },
      stockStatItem: {
        flex: 1,
        alignItems: 'center' as const,
        paddingHorizontal: 8,
      },
      stockStatLabel: {
        fontSize: 12,
        color: theme.text.secondary,
        marginBottom: 6,
        textAlign: 'center' as const,
        fontWeight: '500' as const,
      },
      stockStatValue: {
        fontSize: 16,
        fontWeight: '700' as const,
        color: theme.text.primary,
        textAlign: 'center' as const,
      },
      potentialProfitValue: {
        color: theme.primary,
      },
      actualProfitValue: {
        color: theme.success,
      },
      
      // Styles pour la section Performance des Sources
      sourcePerformanceContainer: {
        gap: 12,
      },
      sourceCard: {
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
      },
      sourceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      },
      sourceName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.text.primary,
        flex: 1,
      },
      sourceRank: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.primary,
        backgroundColor: theme.primaryContainer,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
      },
      sourceStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
      },
      sourceStat: {
        flex: 1,
        alignItems: 'center',
      },
      sourceStatLabel: {
        fontSize: 12,
        color: theme.text.secondary,
        marginBottom: 2,
        textAlign: 'center',
      },
      sourceStatValue: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.text.primary,
        textAlign: 'center',
      },
      
      // Styles pour la section Paiements Dépôt-Vente
      consignmentContainer: {
        gap: 16,
      },
      consignmentSummary: {
        backgroundColor: theme.primaryContainer,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 16,
      },
      consignmentTotalLabel: {
        fontSize: 14,
        color: theme.onPrimaryContainer,
        marginBottom: 4,
      },
      consignmentTotalValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.onPrimaryContainer,
      },
      consignmentList: {
        gap: 8,
      },
      consignmentItem: {
        backgroundColor: theme.surface,
        borderRadius: 8,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
      },
      consignmentInfo: {
        flex: 1,
        marginRight: 12,
      },
      consignmentItemName: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.text.primary,
        marginBottom: 2,
      },
      consignmentConsignor: {
        fontSize: 12,
        color: theme.text.secondary,
        marginBottom: 2,
      },
      consignmentDetails: {
        fontSize: 12,
        color: theme.text.secondary,
      },
      consignmentAmount: {
        alignItems: 'flex-end',
      },
      consignmentPayment: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.primary,
        marginBottom: 2,
      },
      consignmentDate: {
        fontSize: 11,
        color: theme.text.secondary,
      },
      
      moreItemsText: {
        fontSize: 12,
        color: theme.text.secondary,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 8,
      },
    });
  }

  /**
   * Styles pour SalesChart
   */
  private static getSalesChartStyles(theme: AppThemeType, common: CommonStyles) {
    return StyleSheet.create({
      // Container principal
      salesChartContainer: {
        backgroundColor: theme.surface,
        borderRadius: 12,
        marginHorizontal: 16,
        marginVertical: 8,
        ...common.shadow,
      },
      
      // Header du graphique
      salesChartHeader: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
      },
      salesChartTitleRow: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        marginBottom: 16,
      },
      salesChartTitle: {
        fontSize: 20,
        fontWeight: '700' as const,
        color: theme.text.primary,
      },
      
      // 🆕 ONGLETS DE PÉRIODE
      periodTabsContainer: {
        flexDirection: 'row' as const,
        backgroundColor: theme.backgroundSecondary,
        borderRadius: 10,
        padding: 4,
        marginBottom: 16,
      },
      periodTab: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
      },
      periodTabActive: {
        backgroundColor: theme.primary,
        ...common.shadow,
      },
      periodTabIcon: {
        fontSize: 16,
        marginBottom: 2,
      },
      periodTabLabel: {
        fontSize: 13,
        fontWeight: '600' as const,
        color: theme.text.secondary,
        marginBottom: 1,
      },
      periodTabLabelActive: {
        color: theme.text.onPrimary,
      },
      periodTabSubtitle: {
        fontSize: 10,
        color: theme.text.secondary,
        fontWeight: '400' as const,
      },
      periodTabSubtitleActive: {
        color: theme.text.onPrimary,
        opacity: 0.8,
      },
      
      // Totaux et infos
      salesTotalContainer: {
        alignItems: 'center' as const,
        marginBottom: 16,
      },
      salesTotalAmount: {
        fontSize: 32,
        fontWeight: '800' as const,
        color: theme.primary,
        marginBottom: 4,
      },
      salesTotalPeriod: {
        fontSize: 14,
        color: theme.text.secondary,
        marginBottom: 2,
      },
      salesInfoText: {
        fontSize: 12,
        color: theme.text.secondary,
        fontStyle: 'italic' as const,
      },
      
      // Navigation temporelle
      salesNavigationExtended: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 8,
        paddingVertical: 8,
        flexWrap: 'wrap' as const,
        gap: 8,
      },
      
      // Groupes de navigation
      navGroup: {
        flexDirection: 'row' as const,
        gap: 6,
        alignItems: 'center' as const,
      },
      
      // Boutons de navigation
      salesNavButton: {
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: theme.backgroundSecondary,
        borderWidth: 1,
        borderColor: theme.border,
        minWidth: 60,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
      },
      salesNavButtonFast: {
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: theme.primary + '15',
        borderWidth: 1,
        borderColor: theme.primary + '30',
        minWidth: 65,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
      },
      salesNavButtonDisabled: {
        opacity: 0.4,
        backgroundColor: theme.border,
      },
      
      // Textes des boutons
      salesNavButtonText: {
        fontSize: 11,
        fontWeight: '500' as const,
        color: theme.text.primary,
      },
      salesNavButtonFastText: {
        fontSize: 11,
        fontWeight: '600' as const,
        color: theme.primary,
      },
      salesNavButtonTextDisabled: {
        color: theme.text.disabled,
      },
      
      // Bouton aujourd'hui
      salesTodayButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: theme.success + '15',
        borderWidth: 1,
        borderColor: theme.success + '30',
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        flex: 1,
        maxWidth: 140,
      },
      salesTodayButtonDisabled: {
        backgroundColor: theme.border,
        borderColor: theme.border,
      },
      salesTodayButtonText: {
        fontSize: 12,
        fontWeight: '600' as const,
        color: theme.success,
      },
      salesTodayButtonTextDisabled: {
        color: theme.text.disabled,
      },
      
      // Contenu du graphique
      salesChartContent: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        flex: 1,
      },
      
      // États loading/erreur
      loadingContainer: {
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        paddingVertical: 40,
      },
      loadingText: {
        color: theme.text.secondary,
        fontSize: 14,
      },
      noDataContainer: {
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        paddingVertical: 60,
      },
      noDataText: {
        color: theme.text.secondary,
        fontSize: 16,
        fontStyle: 'italic' as const,
      },
      
      // Wrapper du graphique
      chartWrapper: {
        alignItems: 'center' as const,
      },
      
      // 🆕 TOOLTIP DE DÉTAIL DU JOUR
      dayDetailTooltip: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        zIndex: 1000,
      },
      dayDetailContent: {
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 24,
        marginHorizontal: 32,
        alignItems: 'center' as const,
        ...common.shadow,
        minWidth: 250,
      },
      dayDetailClose: {
        position: 'absolute' as const,
        top: 8,
        right: 8,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.border,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
      },
      dayDetailCloseText: {
        color: theme.text.secondary,
        fontSize: 16,
        fontWeight: '600' as const,
      },
      dayDetailDate: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: theme.text.primary,
        marginBottom: 8,
        textAlign: 'center' as const,
      },
      dayDetailAmount: {
        fontSize: 24,
        fontWeight: '800' as const,
        color: theme.primary,
        marginBottom: 4,
      },
      dayDetailLabel: {
        fontSize: 14,
        color: theme.text.secondary,
        marginBottom: 8,
      },
      dayDetailNoSales: {
        fontSize: 12,
        color: theme.text.secondary,
        fontStyle: 'italic' as const,
        textAlign: 'center' as const,
      },
      
      // 🆕 LÉGENDE DU GRAPHIQUE
      salesLegend: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: theme.border,
      },
      salesLegendItem: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
      },
      salesLegendColor: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 8,
      },
      salesLegendText: {
        fontSize: 12,
        color: theme.text.secondary,
        fontWeight: '500' as const,
      },
      salesClickHint: {
        fontSize: 11,
        color: theme.text.secondary,
        fontStyle: 'italic' as const,
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
      
      // Styles pour la page d'administration des permissions
      sectionDescription: {
        fontSize: 14,
        color: theme.text.secondary,
        marginBottom: 16,
        lineHeight: 20,
      },
      userList: {
        marginTop: 16,
      },
      userCard: {
        backgroundColor: theme.surface,
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        borderWidth: 1,
        borderColor: theme.border,
      },
      userInfo: {
        flex: 1,
      },
      userEmail: {
        fontSize: 16,
        fontWeight: '500' as const,
        color: theme.text.primary,
        marginBottom: 4,
      },
      userRole: {
        fontSize: 14,
        color: theme.text.secondary,
      },
      userActions: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
      },
      manageButton: {
        backgroundColor: theme.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
      },
      manageButtonText: {
        color: theme.text.onPrimary,
        fontSize: 14,
        fontWeight: '500' as const,
      },
      selectedUserHeader: {
        backgroundColor: theme.surface,
        padding: 16,
        borderRadius: 8,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: theme.border,
      },
      selectedUserEmail: {
        fontSize: 18,
        fontWeight: '600' as const,
        color: theme.text.primary,
        marginBottom: 4,
      },
      selectedUserRole: {
        fontSize: 14,
        color: theme.text.secondary,
      },
      updatingBanner: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: theme.warning.light,
        padding: 12,
        borderRadius: 6,
        marginBottom: 16,
      },
      updatingText: {
        marginLeft: 8,
        fontSize: 14,
        color: theme.warning.main,
      },
      permissionSection: {
        marginBottom: 24,
      },
      permissionSectionTitle: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: theme.text.primary,
        marginBottom: 12,
      },
      permissionRow: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: theme.surface,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: theme.border,
      },
      permissionInfo: {
        flex: 1,
        marginRight: 16,
      },
      permissionLabel: {
        fontSize: 14,
        fontWeight: '500' as const,
        color: theme.text.primary,
        marginBottom: 2,
      },
      permissionDescription: {
        fontSize: 12,
        color: theme.text.secondary,
        lineHeight: 16,
      },
      errorContainer: {
        backgroundColor: theme.danger.light,
        padding: 12,
        borderRadius: 6,
        marginTop: 16,
      },
      errorText: {
        color: theme.danger.main,
        fontSize: 14,
        textAlign: 'center' as const,
      },
      
      // Nouveaux styles pour les features étendues
      roleContainer: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        marginTop: 4,
      },
      roleBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start' as const,
      },
      roleBadgeText: {
        fontSize: 11,
        fontWeight: '600' as const,
        color: '#FFFFFF',
        textTransform: 'uppercase' as const,
      },
      inviteButton: {
        backgroundColor: theme.success,
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 12,
        marginTop: 20,
        alignItems: 'center' as const,
        borderWidth: 1,
        borderColor: theme.success,
        ...Platform.select({
          web: {
            boxShadow: `0 4px 12px ${theme.success}30`,
          },
          default: {
            shadowColor: theme.success,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 4,
          },
        }),
      },
      inviteButtonText: {
        color: theme.text.onPrimary,
        fontSize: 16,
        fontWeight: '700' as const,
      },
      userMainInfo: {
        flexDirection: 'row' as const,
        alignItems: 'flex-start' as const,
        justifyContent: 'space-between' as const,
        marginBottom: 16,
      },
      userInfoSection: {
        flex: 1,
        marginRight: 12,
      },
      roleSection: {
        alignItems: 'flex-end' as const,
      },
      roleSelector: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginBottom: 8,
      },
      changeRoleText: {
        fontSize: 12,
        color: theme.primary,
        marginLeft: 8,
        fontWeight: '500' as const,
      },
      roleChangeButton: {
        backgroundColor: theme.primary,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        marginLeft: 8,
      },
      roleChangeButtonText: {
        color: theme.text.onPrimary,
        fontSize: 11,
        fontWeight: '600' as const,
        textTransform: 'uppercase' as const,
      },
      defaultPermissionsContainer: {
        flexDirection: 'row' as const,
        gap: 8,
        marginTop: 8,
      },
      defaultPermissionsButton: {
        backgroundColor: theme.feedback.warning + '20',
        borderWidth: 1,
        borderColor: theme.feedback.warning,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center' as const,
        flex: 1,
      },
      defaultPermissionsButtonText: {
        color: theme.feedback.warning,
        fontSize: 14,
        fontWeight: '600' as const,
      },
      manageDefaultsButton: {
        backgroundColor: theme.secondary + '20',
        borderWidth: 1,
        borderColor: theme.secondary,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center' as const,
        flex: 1,
      },
      manageDefaultsButtonText: {
        color: theme.secondary,
        fontSize: 14,
        fontWeight: '600' as const,
      },
      
      // Styles pour les tabs de rôles
      roleTab: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.border,
        alignItems: 'center' as const,
      },
      roleTabActive: {
        borderColor: 'transparent',
      },
      roleTabText: {
        fontSize: 14,
        fontWeight: '500' as const,
        color: theme.text.primary,
      },
      roleTabTextActive: {
        color: '#fff',
        fontWeight: '600' as const,
      },
      
      // Styles pour les modales
      modalOverlay: {
        flex: 1,
        backgroundColor: theme.backdrop,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        padding: 20,
      },
      modalContent: {
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 24,
        minWidth: 320,
        maxWidth: 400,
        width: '100%',
        borderWidth: 1,
        borderColor: theme.border,
        ...Platform.select({
          web: {
            boxShadow: `0 8px 32px ${theme.backdrop}`,
          },
          default: {
            shadowColor: theme.backdrop,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8,
          },
        }),
      },
      modalTitle: {
        fontSize: 20,
        fontWeight: '700' as const,
        color: theme.text.primary,
        marginBottom: 24,
        textAlign: 'center' as const,
      },
      roleOption: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: theme.border,
        backgroundColor: theme.backgroundSecondary,
      },
      roleOptionSelected: {
        backgroundColor: theme.primary + '15',
        borderColor: theme.primary,
      },
      emailInput: {
        ...common.input,
        marginBottom: 16,
      },
      roleLabel: {
        fontSize: 16,
        fontWeight: '500' as const,
        color: theme.text.primary,
        marginBottom: 12,
      },
      modalButtons: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        marginTop: 24,
        gap: 12,
      },
      modalCancelButton: {
        backgroundColor: theme.backgroundSecondary,
        borderWidth: 1,
        borderColor: theme.border,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 10,
        flex: 1,
        alignItems: 'center' as const,
      },
      modalCancelButtonText: {
        color: theme.text.secondary,
        fontSize: 16,
        fontWeight: '600' as const,
      },
      modalConfirmButton: {
        backgroundColor: theme.primary,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 10,
        flex: 1,
        alignItems: 'center' as const,
      },
      modalConfirmButtonText: {
        color: theme.text.onPrimary,
        fontSize: 16,
        fontWeight: '600' as const,
      },
      modalConfirmButtonDisabled: {
        backgroundColor: theme.text.disabled,
        opacity: 0.5,
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
      
      // ✅ AMÉLIORATION - Layout compact pour mobile
      itemRow: {
        backgroundColor: theme.surface,
        marginHorizontal: 8,
        marginVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.border,
        ...Platform.select({
          web: {
            boxShadow: `0 1px 4px ${theme.backdrop}20`,
          },
          default: {
            shadowColor: theme.backdrop,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
          },
        }),
      },
      itemRowSelected: {
        borderColor: theme.primary,
        borderWidth: 2,
        backgroundColor: theme.primaryLight || theme.primary + '15',
        ...Platform.select({
          web: {
            boxShadow: `0 2px 8px ${theme.primary}30`,
          },
          default: {
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 3,
          },
        }),
      },
      
      itemContent: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        padding: 10,
      },
      
      itemTextContainer: {
        flex: 1,
        marginRight: 10,
      },
      
      itemHeader: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        marginBottom: 4,
      },
      
      itemIcon: {
        marginRight: 8,
        padding: 4,
        borderRadius: 6,
        backgroundColor: theme.surface,
      },
      
      itemIconSelected: {
        backgroundColor: theme.primary + '20',
      },
      
      itemName: {
        fontSize: 15,
        fontWeight: '600' as const,
        color: theme.text.primary,
        flex: 1,
        marginBottom: 1,
      },
      itemNameSelected: {
        color: theme.primary,
        fontWeight: '700' as const,
      },
      
      itemDetails: {
        marginTop: 2,
      },
      
      itemDescription: {
        fontSize: 12,
        color: theme.text.secondary,
        lineHeight: 16,
        marginBottom: 2,
      },
      itemDescriptionSelected: {
        color: theme.primary + 'CC',
      },
      
      itemMetaRow: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        marginTop: 2,
        flexWrap: 'wrap' as const,
      },
      
      itemMetaItem: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        marginRight: 12,
        marginBottom: 2,
      },
      
      itemMetaIcon: {
        marginRight: 3,
      },
      
      itemContainerName: {
        fontSize: 11,
        color: theme.text.secondary,
        fontWeight: '500' as const,
      },
      itemContainerNameSelected: {
        color: theme.primary + 'DD',
      },
      
      itemPrice: {
        fontSize: 13,
        color: theme.success || '#4CAF50',
        fontWeight: '600' as const,
      },
      itemPriceSelected: {
        color: theme.primary,
        fontWeight: '700' as const,
      },
      
      itemStatus: {
        fontSize: 10,
        fontWeight: '600' as const,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 8,
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
        padding: 4,
        borderRadius: 6,
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
        minHeight: Platform.OS === 'ios' ? 44 : 56,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 10,
        paddingBottom: 8, // Padding bottom pour espacer du contenu
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
        paddingVertical: 10, // Padding uniforme
        paddingHorizontal: 8,
        minWidth: 50,
        minHeight: 40, // Zone de touch standard
        justifyContent: 'flex-start' as const,
      },
      
      backButtonText: {
        fontSize: 17,
        color: theme.primary,
        marginLeft: 4,
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
        paddingTop: Platform.OS === 'ios' ? 20 : 16, // Plus d'espace en haut sur iOS
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

  /**
   * Styles pour ExportButtons - Boutons d'export de données
   */
  private static getExportButtonsStyles(theme: AppThemeType, _common: CommonStyles) {
    return StyleSheet.create({
      container: {
        margin: 12,
      },
      
      mainButton: {
        backgroundColor: theme.primary,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: theme.backdrop,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      
      mainButtonText: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: theme.text.onPrimary,
        marginBottom: 2,
      },
      
      mainButtonSubtext: {
        fontSize: 12,
        color: theme.text.onPrimary + '80',
      },
      
      modalOverlay: {
        flex: 1,
        backgroundColor: theme.backdrop,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      },
      
      modalContent: {
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 20,
        width: '95%',
        maxWidth: 500,
        maxHeight: '85%',
        elevation: 8,
        shadowColor: theme.backdrop,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      
      modalTitle: {
        fontSize: 20,
        fontWeight: '600' as const,
        color: theme.text.primary,
        textAlign: 'center',
        marginBottom: 8,
      },
      
      modalSubtitle: {
        fontSize: 14,
        color: theme.text.secondary,
        textAlign: 'center',
        marginBottom: 24,
      },
      
      formatButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 24,
      },
      
      exportButton: {
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        minWidth: 80,
        backgroundColor: 'transparent',
      },
      
      exportButtonText: {
        fontSize: 14,
        fontWeight: '600' as const,
        marginTop: 8,
        marginBottom: 4,
      },
      
      formatIcon: {
        fontSize: 24,
        marginBottom: 4,
      },
      
      formatDescription: {
        fontSize: 11,
        textAlign: 'center',
      },
      
      cancelButton: {
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 20,
        alignItems: 'center',
        backgroundColor: 'transparent',
      },
      
      cancelButtonText: {
        fontSize: 16,
        fontWeight: '500' as const,
      },
      
      columnOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderRadius: 8,
        marginBottom: 8,
      },
      
      oldCheckbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
      },
      
      columnLabel: {
        fontSize: 14,
        flex: 1,
      },
      
      
      defaultBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
      },
      
      defaultBadgeText: {
        fontSize: 8,
        fontWeight: '600',
        textTransform: 'uppercase',
      },
      
      // Styles simples et efficaces
      simpleSection: {
        marginBottom: 24,
      },
      
      simpleSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
      },
      
      // Statut simple
      simpleButtonRow: {
        flexDirection: 'row',
        gap: 8,
      },
      
      simpleButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
      },
      
      simpleButtonText: {
        fontSize: 13,
        fontWeight: '500',
        marginBottom: 2,
      },
      
      simpleButtonCount: {
        fontSize: 11,
      },
      
      // Catégories simples
      allCategoriesSimple: {
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 12,
        alignItems: 'center',
      },
      
      allCategoriesSimpleText: {
        fontSize: 14,
        fontWeight: '500',
      },
      
      categoriesSimpleGrid: {
        gap: 8,
      },
      
      categorySimpleCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 6,
      },
      
      categorySimpleContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
      },
      
      categorySimpleText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '400',
      },
      
      categorySimpleCount: {
        fontSize: 12,
      },
      
      // Résumé
      summaryBox: {
        padding: 12,
        borderRadius: 8,
        marginVertical: 16,
        alignItems: 'center',
      },
      
      summaryText: {
        fontSize: 14,
        fontWeight: '600',
      },
      
      // Boutons rapides
      quickButtons: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
      },
      
      quickButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        borderWidth: 1,
        alignItems: 'center',
      },
      
      quickButtonText: {
        fontSize: 12,
        fontWeight: '500',
      },
      
      // Liste des colonnes
      columnsSimpleList: {
        gap: 4,
      },
      
      columnSimpleItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 6,
        borderBottomWidth: 1,
      },
      
      checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
      },
      
      columnSimpleLabel: {
        flex: 1,
        fontSize: 14,
      },
      
      recommendedBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
      },
      
      recommendedText: {
        fontSize: 10,
        fontWeight: '600',
      },
      
      // Boutons d'action
      actionButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: theme.border,
      },
    });
  }

  /**
   * Styles pour SourcesScreen
   */
  private static getSourcesScreenStyles(theme: AppThemeType, commonStyles: any): any {
    return StyleSheet.create({
      ...commonStyles,
      container: {
        flex: 1,
        backgroundColor: theme.background,
      },
      header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 8,
      },
      searchbar: {
        flex: 1,
      },
      listContainer: {
        padding: 16,
        paddingTop: 0,
        paddingBottom: 100,
      },
      sourceCard: {
        marginBottom: 12,
      },
      sourceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
      sourceInfo: {
        flex: 1,
      },
      sourceName: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
        color: theme.text.primary,
      },
      sourceDetails: {
        color: theme.text.secondary,
        fontSize: 14,
      },
      sourceMetrics: {
        flexDirection: 'row',
        marginTop: 12,
        gap: 8,
      },
      typeChip: {
        backgroundColor: theme.surface,
      },
      emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
      },
      emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
        color: theme.text.primary,
      },
      emptySubtitle: {
        fontSize: 14,
        color: theme.text.secondary,
        textAlign: 'center',
      },
      loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      },
      fab: {
        position: 'absolute',
        right: 16,
        bottom: 16,
      },
    });
  }

  /**
   * Styles pour AddSourceScreen
   */
  private static getAddSourceScreenStyles(theme: AppThemeType, commonStyles: any): any {
    return StyleSheet.create({
      ...commonStyles,
      container: {
        flex: 1,
        backgroundColor: theme.background,
      },
      content: {
        padding: 16,
      },
      card: {
        marginBottom: 24,
      },
      title: {
        marginBottom: 24,
        color: theme.text.primary,
      },
      form: {
        gap: 16,
      },
      input: {
        backgroundColor: theme.surface,
      },
      typeSection: {
        gap: 8,
      },
      typeLabel: {
        color: theme.text.primary,
      },
      segmentedButtons: {
        marginVertical: 8,
      },
      errorText: {
        color: theme.error,
        fontSize: 12,
        marginTop: 4,
      },
      actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
      },
      cancelButton: {
        flex: 1,
      },
      submitButton: {
        flex: 1,
      },
    });
  }

  /**
   * Styles pour SourceDetailScreen
   */
  private static getSourceDetailScreenStyles(theme: AppThemeType, commonStyles: any): any {
    return StyleSheet.create({
      ...commonStyles,
      container: {
        flex: 1,
        backgroundColor: theme.background,
      },
      content: {
        padding: 16,
      },
      headerCard: {
        marginBottom: 16,
      },
      header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      },
      sourceInfo: {
        flex: 1,
      },
      sourceName: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
        color: theme.text.primary,
      },
      sourceDetails: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      },
      cityText: {
        color: theme.text.secondary,
        fontSize: 14,
      },
      statsCard: {
        marginBottom: 16,
      },
      itemsCard: {
        marginBottom: 16,
      },
      itemsList: {
        marginTop: 8,
      },
      statusChip: {
        alignSelf: 'center',
        marginRight: 8,
      },
      emptyText: {
        textAlign: 'center',
        color: theme.text.secondary,
        fontStyle: 'italic',
        marginTop: 16,
      },
      moreItemsText: {
        textAlign: 'center',
        color: theme.text.secondary,
        fontStyle: 'italic',
        marginTop: 8,
      },
    });
  }
}

export default StyleFactory; 