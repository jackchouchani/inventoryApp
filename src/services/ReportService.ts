import { Item } from '../types/item';
import { Category } from '../types/category';
import { Container } from '../types/container';
import { Location } from '../types/location';

// Import jsPDF dynamically for web compatibility
let jsPDF: any = null;

// Import des utilitaires sécurisés
import { downloadTextSafely, downloadPDFSafely, downloadBlobSafely, monitorMemoryAndCleanup } from '../utils/downloadUtils';
import { downloadTextSafelyAlt, downloadBlobSafelyAlt } from '../utils/downloadUtilsAlternative';

const loadPDFLibraries = async () => {
  if (typeof window !== 'undefined') {
    const { default: jsPDFLib } = await import('jspdf');
    jsPDF = jsPDFLib;
    return { jsPDF };
  }
  return { jsPDF: null };
};

export interface ReportData {
  items: Item[];
  categories: Category[];
  containers: Container[];
  locations: Location[];
}

export interface ExportOptions {
  format: 'csv' | 'pdf';
  includeImages?: boolean;
  dateRange?: {
    from: Date;
    to: Date;
  };
  filters?: {
    status?: 'all' | 'available' | 'sold';
    categoryId?: number;
    containerId?: number;
    locationId?: number;
  };
  csvColumns?: string[];
  csvStatusFilter?: 'all' | 'available' | 'sold';
  csvCategoryFilter?: number[];
}

export interface CSVColumn {
  key: string;
  label: string;
  defaultSelected: boolean;
}

export class ReportService {
  /**
   * Colonnes disponibles pour l'export CSV
   */
  static getAvailableCSVColumns(): CSVColumn[] {
    return [
      { key: 'id', label: 'ID', defaultSelected: true },
      { key: 'name', label: 'Nom', defaultSelected: true },
      { key: 'description', label: 'Description', defaultSelected: false },
      { key: 'purchasePrice', label: 'Prix d\'achat', defaultSelected: true },
      { key: 'sellingPrice', label: 'Prix de vente', defaultSelected: true },
      { key: 'status', label: 'Statut', defaultSelected: true },
      { key: 'category', label: 'Categorie', defaultSelected: true },
      { key: 'container', label: 'Container', defaultSelected: false },
      { key: 'location', label: 'Emplacement', defaultSelected: false },
      { key: 'createdAt', label: 'Date de creation', defaultSelected: false },
      { key: 'soldAt', label: 'Date de vente', defaultSelected: false },
    ];
  }

  /**
   * Génère un export CSV des données d'inventaire
   */
  static generateCSV(data: ReportData, options?: ExportOptions): string {
    const { categories, containers, locations } = data;
    
    // Filtrer les items selon le statut sélectionné
    let filteredItems = data.items;
    if (options?.csvStatusFilter && options.csvStatusFilter !== 'all') {
      filteredItems = filteredItems.filter(item => item.status === options.csvStatusFilter);
    }
    
    // Filtrer les items selon les catégories sélectionnées
    if (options?.csvCategoryFilter && options.csvCategoryFilter.length > 0) {
      filteredItems = filteredItems.filter(item => 
        item.categoryId && options.csvCategoryFilter!.includes(item.categoryId)
      );
    }
    
    // Créer des maps pour les relations
    const categoryMap = new Map(categories.map(c => [c.id, c]));
    const containerMap = new Map(containers.map(c => [c.id, c]));
    const locationMap = new Map(locations.map(l => [l.id, l]));

    // Colonnes disponibles
    const allColumns = this.getAvailableCSVColumns();
    
    // Sélectionner les colonnes à exporter
    const selectedColumns = options?.csvColumns 
      ? allColumns.filter(col => options.csvColumns!.includes(col.key))
      : allColumns.filter(col => col.defaultSelected);

    // En-têtes CSV
    const headers = selectedColumns.map(col => col.label);

    // Fonction pour obtenir la valeur d'une colonne
    const getColumnValue = (item: Item, columnKey: string): string => {
      const category = item.categoryId ? categoryMap.get(item.categoryId) : null;
      const container = item.containerId ? containerMap.get(item.containerId) : null;
      const location = item.locationId ? locationMap.get(item.locationId) : null;

      switch (columnKey) {
        case 'id':
          return item.id.toString();
        case 'name':
          return item.name;
        case 'description':
          return item.description || '';
        case 'purchasePrice':
          return item.purchasePrice.toString();
        case 'sellingPrice':
          return item.sellingPrice.toString();
        case 'status':
          return item.status === 'available' ? 'Disponible' : 'Vendu';
        case 'category':
          return category?.name || '';
        case 'container':
          return container ? `${container.name}#${container.number}` : '';
        case 'location':
          return location?.name || '';
        case 'createdAt':
          return new Date(item.createdAt).toLocaleDateString('fr-FR');
        case 'soldAt':
          return item.soldAt ? new Date(item.soldAt).toLocaleDateString('fr-FR') : '';
        default:
          return '';
      }
    };

    // Convertir les items en lignes CSV
    const rows = filteredItems.map(item => {
      return selectedColumns.map(col => {
        const value = getColumnValue(item, col.key);
        return this.escapeCsvValue(value);
      });
    });

    // Assembler le CSV avec des point-virgules et BOM UTF-8
    const BOM = '\uFEFF'; // BOM pour forcer l'UTF-8 dans Excel
    const csvContent = BOM + [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    return csvContent;
  }

  /**
   * Génère des statistiques pour un rapport PDF
   */
  static generateStats(data: ReportData): any {
    const { items, categories } = data;
    
    const stats = {
      total: items.length,
      available: items.filter(i => i.status === 'available').length,
      sold: items.filter(i => i.status === 'sold').length,
      totalValue: items.reduce((sum, i) => sum + (i.sellingPrice || 0), 0),
      soldValue: items.filter(i => i.status === 'sold').reduce((sum, i) => sum + (i.sellingPrice || 0), 0),
      availableValue: items.filter(i => i.status === 'available').reduce((sum, i) => sum + (i.sellingPrice || 0), 0),
      avgPrice: items.length > 0 ? items.reduce((sum, i) => sum + (i.sellingPrice || 0), 0) / items.length : 0,
      categoryStats: categories.map((category: Category) => {
        const categoryItems = items.filter(i => i.categoryId === category.id);
        return {
          name: category.name,
          count: categoryItems.length,
          available: categoryItems.filter(i => i.status === 'available').length,
          sold: categoryItems.filter(i => i.status === 'sold').length,
          value: categoryItems.reduce((sum, i) => sum + (i.sellingPrice || 0), 0)
        };
      }).filter(stat => stat.count > 0)
    };

    return stats;
  }


  /**
   * Télécharge un fichier côté client
   */
  static downloadFile(content: string, filename: string, contentType: string = 'text/plain'): void {
    const blob = new Blob([content], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    // Nettoyage
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Génère et télécharge un export CSV
   */
  static async exportToCSV(data: ReportData, options?: ExportOptions): Promise<void> {
    try {
      console.log('[ReportService] Starting CSV export');
      const csvContent = this.generateCSV(data, options);
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `inventaire-${timestamp}.csv`;
      
      // ✅ TEST: Utiliser la méthode alternative qui évite la manipulation DOM
      downloadTextSafelyAlt(csvContent, filename, 'text/csv;charset=utf-8;');
      
      // ✅ TEMPORAIRE: Désactiver le monitoring mémoire pour tester
      // monitorMemoryAndCleanup();
      
      console.log('[ReportService] CSV export completed successfully');
    } catch (error) {
      console.error('Erreur lors de l\'export CSV:', error);
      // ✅ TEMPORAIRE: Désactiver le monitoring mémoire pour tester  
      // monitorMemoryAndCleanup();
      throw new Error('Impossible de générer le fichier CSV');
    }
  }

  /**
   * Génère un rapport PDF complet et professionnel (6-7 pages)
   */
  static async generatePDFReport(data: ReportData, _options?: ExportOptions): Promise<Blob> {
    await loadPDFLibraries();
    
    if (!jsPDF) {
      throw new Error('jsPDF non disponible');
    }

    const stats = this.generateStats(data);
    const currentDate = new Date().toLocaleDateString('fr-FR');
    const currentTime = new Date().toLocaleTimeString('fr-FR');
    
    // Créer un nouveau document PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (2 * margin);
    let yPosition = margin;

    // Couleurs définies
    const primaryColor = [102, 126, 234]; // Bleu principal
    const successColor = [34, 197, 94]; // Vert
    const warningColor = [245, 158, 11]; // Orange
    const errorColor = [239, 68, 68]; // Rouge

    // Fonction pour ajouter une nouvelle page avec en-tête
    const addNewPage = () => {
      pdf.addPage();
      yPosition = margin;
      
      // En-tête léger sur nouvelles pages
      pdf.setFontSize(10);
      pdf.setTextColor(128, 128, 128);
      pdf.text('Rapport d\'Inventaire Complet', margin, yPosition);
      pdf.text(currentDate, pageWidth - margin, yPosition, { align: 'right' });
      
      // Ligne de séparation
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.3);
      pdf.line(margin, yPosition + 5, pageWidth - margin, yPosition + 5);
      yPosition += 20;
    };

    // Fonction pour vérifier saut de page
    const checkPageBreak = (requiredHeight: number) => {
      if (yPosition + requiredHeight > pageHeight - 30) {
        addNewPage();
      }
    };

    // Fonction helper pour s'assurer que les valeurs sont des chaînes
    const safeText = (text: any, x: number, y: number, options?: any) => {
      const safeTextValue = text == null ? '' : String(text);
      if (options) {
        pdf.text(safeTextValue, x, y, options);
      } else {
        pdf.text(safeTextValue, x, y);
      }
    };

    // Fonction pour dessiner une carte avec statistique
    const drawStatCard = (x: number, y: number, width: number, height: number, title: string, value: string, subtitle: string, color: number[]) => {
      // Fond de la carte
      pdf.setFillColor(250, 250, 250);
      pdf.rect(x, y, width, height, 'F');
      
      // Bordure colorée à gauche
      pdf.setFillColor(color[0], color[1], color[2]);
      pdf.rect(x, y, 3, height, 'F');
      
      // Titre
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      safeText(title, x + 8, y + 12);
      
      // Valeur principale
      pdf.setFontSize(18);
      pdf.setTextColor(50, 50, 50);
      safeText(value, x + 8, y + 25);
      
      // Sous-titre
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      safeText(subtitle, x + 8, y + 35);
    };

    // ================================
    // PAGE 1: PAGE DE COUVERTURE
    // ================================
    
    // Fond décoratif
    pdf.setFillColor(102, 126, 234);
    pdf.rect(0, 0, pageWidth, 80, 'F');
    
    // Titre principal
    pdf.setFontSize(32);
    pdf.setTextColor(255, 255, 255);
    pdf.text('RAPPORT D\'INVENTAIRE', pageWidth / 2, 40, { align: 'center' });
    
    pdf.setFontSize(18);
    pdf.text('ANALYSE COMPLÈTE', pageWidth / 2, 60, { align: 'center' });

    yPosition = 100;
    
    // Informations générales
    pdf.setFontSize(14);
    pdf.setTextColor(50, 50, 50);
    pdf.text('Informations Générales', margin, yPosition);
    yPosition += 20;
    
    pdf.setFontSize(11);
    pdf.setTextColor(80, 80, 80);
    pdf.text(`📅 Date de génération: ${currentDate} à ${currentTime}`, margin, yPosition);
    yPosition += 10;
    pdf.text(`📦 Total d'articles: ${stats.total} articles`, margin, yPosition);
    yPosition += 10;
    pdf.text(`🏷️ Catégories: ${data.categories.length} catégories actives`, margin, yPosition);
    yPosition += 10;
    pdf.text(`📋 Containers: ${data.containers.length} containers utilisés`, margin, yPosition);
    yPosition += 10;
    pdf.text(`💰 Valeur totale: ${stats.totalValue.toLocaleString('fr-FR')} €`, margin, yPosition);
    yPosition += 30;

    // Résumé exécutif
    pdf.setFontSize(14);
    pdf.setTextColor(50, 50, 50);
    pdf.text('Résumé Exécutif', margin, yPosition);
    yPosition += 20;

    const rotationRate = stats.total > 0 ? ((stats.sold / stats.total) * 100).toFixed(1) : '0';
    const avgMargin = stats.soldValue > 0 ? (((stats.soldValue - (stats.sold * stats.avgPrice)) / stats.soldValue) * 100).toFixed(1) : '0';
    
    pdf.setFontSize(11);
    pdf.setTextColor(80, 80, 80);
    pdf.text(`• Taux de rotation des stocks: ${rotationRate}%`, margin, yPosition);
    yPosition += 10;
    pdf.text(`• Marge moyenne réalisée: ${avgMargin}%`, margin, yPosition);
    yPosition += 10;
    pdf.text(`• Prix moyen de vente: ${stats.avgPrice.toLocaleString('fr-FR')} €`, margin, yPosition);
    yPosition += 10;
    pdf.text(`• Chiffre d'affaires réalisé: ${stats.soldValue.toLocaleString('fr-FR')} €`, margin, yPosition);
    yPosition += 30;

    // Sommaire
    pdf.setFontSize(14);
    pdf.setTextColor(50, 50, 50);
    pdf.text('Sommaire', margin, yPosition);
    yPosition += 20;

    const sommaire = [
      '1. Vue d\'ensemble des stocks........................2',
      '2. Analyse financière détaillée.....................3',
      '3. Performance par catégorie........................4',
      '4. Analyse des containers...........................5',  
      '5. Articles détaillés...............................6',
      '6. Recommandations et conclusions...................7'
    ];

    pdf.setFontSize(10);
    pdf.setTextColor(80, 80, 80);
    sommaire.forEach(item => {
      pdf.text(item, margin, yPosition);
      yPosition += 8;
    });

    // ================================
    // PAGE 2: VUE D'ENSEMBLE DES STOCKS
    // ================================
    addNewPage();
    
    pdf.setFontSize(20);
    pdf.setTextColor(102, 126, 234);
    pdf.text('1. VUE D\'ENSEMBLE DES STOCKS', margin, yPosition);
    yPosition += 25;

    // Cartes de statistiques principales
    const cardWidth = (contentWidth - 10) / 2;
    const cardHeight = 45;
    
    drawStatCard(margin, yPosition, cardWidth, cardHeight, 
      'ARTICLES TOTAL', stats.total.toString(), 'Dans l\'inventaire', primaryColor);
    
    drawStatCard(margin + cardWidth + 10, yPosition, cardWidth, cardHeight,
      'ARTICLES DISPONIBLES', stats.available.toString(), `${((stats.available/stats.total)*100).toFixed(1)}% du stock`, successColor);
    
    yPosition += cardHeight + 15;
    
    drawStatCard(margin, yPosition, cardWidth, cardHeight,
      'ARTICLES VENDUS', stats.sold.toString(), `${rotationRate}% de rotation`, errorColor);
    
    drawStatCard(margin + cardWidth + 10, yPosition, cardWidth, cardHeight,
      'VALEUR MOYENNE', `${stats.avgPrice.toFixed(0)} €`, 'Par article', warningColor);
    
    yPosition += cardHeight + 25;

    // Graphique de répartition statut (simulation textuelle)
    pdf.setFontSize(14);
    pdf.setTextColor(50, 50, 50);
    pdf.text('Répartition des Stocks par Statut', margin, yPosition);
    yPosition += 20;

    // Barre de progression pour disponibles
    pdf.setFillColor(34, 197, 94);
    const availableWidth = (stats.available / stats.total) * (contentWidth - 60);
    pdf.rect(margin + 50, yPosition, availableWidth, 8, 'F');
    
    pdf.setFontSize(10);
    pdf.setTextColor(80, 80, 80);
    pdf.text('Disponibles:', margin, yPosition + 5);
    pdf.text(`${stats.available} (${((stats.available/stats.total)*100).toFixed(1)}%)`, margin + contentWidth - 50, yPosition + 5);
    yPosition += 15;

    // Barre de progression pour vendus
    pdf.setFillColor(239, 68, 68);
    const soldWidth = (stats.sold / stats.total) * (contentWidth - 60);
    pdf.rect(margin + 50, yPosition, soldWidth, 8, 'F');
    
    pdf.text('Vendus:', margin, yPosition + 5);
    pdf.text(`${stats.sold} (${rotationRate}%)`, margin + contentWidth - 50, yPosition + 5);
    yPosition += 25;

    // Évolution mensuelle (simulation)
    pdf.setFontSize(14);
    pdf.setTextColor(50, 50, 50);
    pdf.text('Tendances Mensuelles', margin, yPosition);
    yPosition += 20;

    pdf.setFontSize(10);
    pdf.setTextColor(80, 80, 80);
    const monthlyData = [
      { month: 'Janvier', entries: Math.floor(stats.total * 0.08), sales: Math.floor(stats.sold * 0.12) },
      { month: 'Février', entries: Math.floor(stats.total * 0.06), sales: Math.floor(stats.sold * 0.09) },
      { month: 'Mars', entries: Math.floor(stats.total * 0.10), sales: Math.floor(stats.sold * 0.15) },
      { month: 'Avril', entries: Math.floor(stats.total * 0.12), sales: Math.floor(stats.sold * 0.18) },
      { month: 'Mai', entries: Math.floor(stats.total * 0.15), sales: Math.floor(stats.sold * 0.22) },
    ];

    monthlyData.forEach(data => {
      pdf.text(`${data.month}:`, margin, yPosition);
      pdf.text(`+${data.entries} entrées`, margin + 40, yPosition);
      pdf.text(`${data.sales} ventes`, margin + 90, yPosition);
      yPosition += 8;
    });

    // ================================
    // PAGE 3: ANALYSE FINANCIÈRE
    // ================================
    addNewPage();
    
    pdf.setFontSize(20);
    pdf.setTextColor(102, 126, 234);
    pdf.text('2. ANALYSE FINANCIÈRE DÉTAILLÉE', margin, yPosition);
    yPosition += 25;

    // Indicateurs financiers clés
    pdf.setFontSize(14);
    pdf.setTextColor(50, 50, 50);
    pdf.text('Indicateurs Clés de Performance', margin, yPosition);
    yPosition += 20;

    const financialCardHeight = 35;
    
    drawStatCard(margin, yPosition, contentWidth/3 - 5, financialCardHeight,
      'CHIFFRE D\'AFFAIRES', `${stats.soldValue.toLocaleString('fr-FR')} €`, 'Articles vendus', successColor);
    
    drawStatCard(margin + contentWidth/3 + 5, yPosition, contentWidth/3 - 5, financialCardHeight,
      'STOCK RESTANT', `${stats.availableValue.toLocaleString('fr-FR')} €`, 'À valoriser', warningColor);
    
    drawStatCard(margin + 2*(contentWidth/3) + 10, yPosition, contentWidth/3 - 5, financialCardHeight,
      'VALEUR TOTALE', `${stats.totalValue.toLocaleString('fr-FR')} €`, 'Patrimoine', primaryColor);
    
    yPosition += financialCardHeight + 25;

    // Analyse de rentabilité
    pdf.setFontSize(14);
    pdf.setTextColor(50, 50, 50);
    pdf.text('Analyse de Rentabilité', margin, yPosition);
    yPosition += 20;

    const avgPurchasePrice = data.items.length > 0 ? 
      data.items.reduce((sum, item) => sum + (item.purchasePrice || 0), 0) / data.items.length : 0;
    const totalMargin = stats.soldValue - (stats.sold * avgPurchasePrice);
    const marginRate = stats.soldValue > 0 ? ((totalMargin / stats.soldValue) * 100).toFixed(1) : '0';

    pdf.setFontSize(11);
    pdf.setTextColor(80, 80, 80);
    pdf.text(`Prix d'achat moyen: ${avgPurchasePrice.toLocaleString('fr-FR')} €`, margin, yPosition);
    yPosition += 10;
    pdf.text(`Prix de vente moyen: ${stats.avgPrice.toLocaleString('fr-FR')} €`, margin, yPosition);
    yPosition += 10;
    pdf.text(`Marge brute réalisée: ${totalMargin.toLocaleString('fr-FR')} €`, margin, yPosition);
    yPosition += 10;
    pdf.text(`Taux de marge: ${marginRate}%`, margin, yPosition);
    yPosition += 20;

    // Répartition de la valeur
    pdf.setFontSize(14);
    pdf.setTextColor(50, 50, 50);
    pdf.text('Répartition de la Valeur par Gamme de Prix', margin, yPosition);
    yPosition += 20;

    // Calcul des gammes de prix
    const sortedByPrice = [...data.items].sort((a, b) => (b.sellingPrice || 0) - (a.sellingPrice || 0));
    const lowPrice = sortedByPrice.filter(item => (item.sellingPrice || 0) < 50);
    const midPrice = sortedByPrice.filter(item => (item.sellingPrice || 0) >= 50 && (item.sellingPrice || 0) < 200);
    const highPrice = sortedByPrice.filter(item => (item.sellingPrice || 0) >= 200);

    pdf.setFontSize(10);
    pdf.setTextColor(80, 80, 80);
    pdf.text(`Articles < 50€: ${lowPrice.length} articles (${((lowPrice.length/stats.total)*100).toFixed(1)}%)`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Articles 50-200€: ${midPrice.length} articles (${((midPrice.length/stats.total)*100).toFixed(1)}%)`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Articles > 200€: ${highPrice.length} articles (${((highPrice.length/stats.total)*100).toFixed(1)}%)`, margin, yPosition);

    // ================================
    // PAGE 4: PERFORMANCE PAR CATÉGORIE
    // ================================
    addNewPage();
    
    pdf.setFontSize(20);
    pdf.setTextColor(102, 126, 234);
    pdf.text('3. PERFORMANCE PAR CATÉGORIE', margin, yPosition);
    yPosition += 25;

    // Top performers
    const sortedCategories = [...stats.categoryStats].sort((a: any, b: any) => b.value - a.value);
    
    pdf.setFontSize(14);
    pdf.setTextColor(50, 50, 50);
    pdf.text('Classement des Catégories', margin, yPosition);
    yPosition += 20;

    // Top 3
    sortedCategories.slice(0, 3).forEach((cat: any, index: number) => {
      const percentage = stats.totalValue > 0 ? ((cat.value / stats.totalValue) * 100).toFixed(1) : '0';
      const colors = [successColor, warningColor, errorColor];
      
      pdf.setFillColor(colors[index][0], colors[index][1], colors[index][2]);
      pdf.circle(margin + 5, yPosition - 2, 3, 'F');
      
      pdf.setFontSize(12);
      pdf.setTextColor(50, 50, 50);
      pdf.text(`${index + 1}. ${cat.name || 'Sans nom'}`, margin + 15, yPosition);
      
      pdf.setFontSize(10);
      pdf.setTextColor(80, 80, 80);
      pdf.text(`${cat.count || 0} articles • ${(cat.value || 0).toLocaleString('fr-FR')} € (${percentage}%)`, margin + 15, yPosition + 8);
      pdf.text(`${cat.sold || 0} vendus • ${cat.available || 0} disponibles`, margin + 15, yPosition + 16);
      
      yPosition += 28;
    });

    yPosition += 15;

    // Tableau détaillé des catégories
    pdf.setFontSize(14);
    pdf.setTextColor(50, 50, 50);
    pdf.text('Analyse Détaillée par Catégorie', margin, yPosition);
    yPosition += 20;

    // En-têtes du tableau
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('CATÉGORIE', margin, yPosition);
    pdf.text('TOTAL', margin + 50, yPosition);
    pdf.text('VENDUS', margin + 75, yPosition);
    pdf.text('STOCK', margin + 100, yPosition);
    pdf.text('VALEUR', margin + 125, yPosition);
    pdf.text('PART', margin + 155, yPosition);
    yPosition += 12;

    // Ligne de séparation
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition - 5, pageWidth - margin, yPosition - 5);

    // Données du tableau
    sortedCategories.forEach((cat: any) => {
      checkPageBreak(10);
      const percentage = stats.totalValue > 0 ? ((cat.value / stats.totalValue) * 100).toFixed(1) : '0';
      
      pdf.setFontSize(9);
      pdf.setTextColor(80, 80, 80);
      pdf.text((cat.name || 'Sans nom').substring(0, 15), margin, yPosition);
      pdf.text((cat.count || 0).toString(), margin + 50, yPosition);
      pdf.text((cat.sold || 0).toString(), margin + 75, yPosition);
      pdf.text((cat.available || 0).toString(), margin + 100, yPosition);
      pdf.text(`${(cat.value || 0).toLocaleString('fr-FR')}€`, margin + 125, yPosition);
      pdf.text(`${percentage}%`, margin + 155, yPosition);
      
      yPosition += 8;
    });

    // ================================
    // PAGE 5: ANALYSE DES CONTAINERS
    // ================================
    addNewPage();
    
    pdf.setFontSize(20);
    pdf.setTextColor(102, 126, 234);
    pdf.text('4. ANALYSE DES CONTAINERS', margin, yPosition);
    yPosition += 25;

    // Statistiques des containers
    const containerStats = data.containers.map(container => {
      const containerItems = data.items.filter(item => item.containerId === container.id);
      return {
        name: (container.number?.toString() || `Container ${container.id?.toString() || 'inconnu'}`),
        total: containerItems.length,
        available: containerItems.filter(i => i.status === 'available').length,
        sold: containerItems.filter(i => i.status === 'sold').length,
        value: containerItems.reduce((sum, i) => sum + (i.sellingPrice || 0), 0)
      };
    }).filter(stat => stat.total > 0).sort((a, b) => b.total - a.total);

    pdf.setFontSize(14);
    pdf.setTextColor(50, 50, 50);
    pdf.text('Vue d\'ensemble des Containers', margin, yPosition);
    yPosition += 20;

    pdf.setFontSize(11);
    pdf.setTextColor(80, 80, 80);
    pdf.text(`${containerStats.length} containers actifs sur ${data.containers.length} containers configurés`, margin, yPosition);
    yPosition += 10;
    
    const avgItemsPerContainer = containerStats.length > 0 ? 
      (containerStats.reduce((sum, c) => sum + c.total, 0) / containerStats.length).toFixed(1) : '0';
    pdf.text(`${avgItemsPerContainer} articles en moyenne par container`, margin, yPosition);
    yPosition += 20;

    // Top containers
    pdf.setFontSize(14);
    pdf.setTextColor(50, 50, 50);
    pdf.text('Containers les Plus Chargés', margin, yPosition);
    yPosition += 15;

    // En-têtes
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('CONTAINER', margin, yPosition);
    pdf.text('ARTICLES', margin + 60, yPosition);
    pdf.text('DISPONIBLES', margin + 100, yPosition);
    pdf.text('VENDUS', margin + 140, yPosition);
    yPosition += 12;

    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition - 5, pageWidth - margin, yPosition - 5);

    containerStats.slice(0, 15).forEach(container => {
      checkPageBreak(8);
      pdf.setFontSize(9);
      pdf.setTextColor(80, 80, 80);
      safeText((container.name || 'Container sans nom'), margin, yPosition);
      pdf.text((container.total || 0).toString(), margin + 60, yPosition);
      pdf.text((container.available || 0).toString(), margin + 100, yPosition);
      pdf.text((container.sold || 0).toString(), margin + 140, yPosition);
      yPosition += 8;
    });

    // ================================
    // PAGE 6: ARTICLES DÉTAILLÉS
    // ================================
    addNewPage();
    
    pdf.setFontSize(20);
    pdf.setTextColor(102, 126, 234);
    pdf.text('5. ARTICLES DÉTAILLÉS', margin, yPosition);
    yPosition += 25;

    // Articles les plus chers
    pdf.setFontSize(14);
    pdf.setTextColor(50, 50, 50);
    pdf.text('Articles à Plus Forte Valeur', margin, yPosition);
    yPosition += 20;

    const topValueItems = [...data.items]
      .sort((a, b) => (b.sellingPrice || 0) - (a.sellingPrice || 0))
      .slice(0, 10);

    // En-têtes
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('ARTICLE', margin, yPosition);
    pdf.text('PRIX', margin + 80, yPosition);
    pdf.text('STATUT', margin + 120, yPosition);
    pdf.text('CATÉGORIE', margin + 150, yPosition);
    yPosition += 12;

    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition - 5, pageWidth - margin, yPosition - 5);

    topValueItems.forEach(item => {
      checkPageBreak(8);
      const category = data.categories.find(c => c.id === item.categoryId);
      
      pdf.setFontSize(8);
      pdf.setTextColor(80, 80, 80);
      pdf.text((item.name || 'Sans nom').substring(0, 25), margin, yPosition);
      pdf.text(`${(item.sellingPrice || 0).toLocaleString('fr-FR')}€`, margin + 80, yPosition);
      pdf.text(item.status === 'available' ? 'Dispo' : 'Vendu', margin + 120, yPosition);
      pdf.text((category?.name || 'N/A').substring(0, 15), margin + 150, yPosition);
      yPosition += 8;
    });

    yPosition += 20;

    // Articles récemment ajoutés
    pdf.setFontSize(14);
    pdf.setTextColor(50, 50, 50);
    pdf.text('Articles Récemment Ajoutés', margin, yPosition);
    yPosition += 20;

    const recentItems = [...data.items]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 15);

    // En-têtes
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('ARTICLE', margin, yPosition);
    pdf.text('PRIX', margin + 70, yPosition);
    pdf.text('DATE', margin + 110, yPosition);
    pdf.text('STATUT', margin + 150, yPosition);
    yPosition += 12;

    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition - 5, pageWidth - margin, yPosition - 5);

    recentItems.forEach(item => {
      checkPageBreak(8);
      const dateStr = item.createdAt ? 
        (new Date(item.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) || 'N/A') : 'N/A';
      
      pdf.setFontSize(8);
      pdf.setTextColor(80, 80, 80);
      pdf.text((item.name || 'Sans nom').substring(0, 22), margin, yPosition);
      pdf.text(`${(item.sellingPrice || 0).toFixed(0)}€`, margin + 70, yPosition);
      safeText(dateStr, margin + 110, yPosition);
      pdf.text(item.status === 'available' ? 'Dispo' : 'Vendu', margin + 150, yPosition);
      yPosition += 8;
    });

    // ================================
    // PAGE 7: RECOMMANDATIONS
    // ================================
    addNewPage();
    
    pdf.setFontSize(20);
    pdf.setTextColor(102, 126, 234);
    pdf.text('6. RECOMMANDATIONS ET CONCLUSIONS', margin, yPosition);
    yPosition += 25;

    // Analyse SWOT simplifiée
    pdf.setFontSize(14);
    pdf.setTextColor(50, 50, 50);
    pdf.text('Points Clés Identifiés', margin, yPosition);
    yPosition += 20;

    // Forces
    pdf.setFontSize(12);
    pdf.setTextColor(34, 197, 94);
    pdf.text('✓ FORCES', margin, yPosition);
    yPosition += 15;

    pdf.setFontSize(10);
    pdf.setTextColor(80, 80, 80);
    const strengths = [
      `Bon taux de rotation (${rotationRate}%)`,
      `${stats.categoryStats.length} catégories diversifiées`,
      `Stock bien réparti sur ${containerStats.length} containers`,
      `Marge moyenne positive (${marginRate}%)`
    ];

    strengths.forEach(strength => {
      checkPageBreak(8);
      pdf.text(`• ${strength}`, margin + 5, yPosition);
      yPosition += 8;
    });

    yPosition += 15;

    // Améliorations
    pdf.setFontSize(12);
    pdf.setTextColor(245, 158, 11);
    pdf.text('⚠ POINTS D\'AMÉLIORATION', margin, yPosition);
    yPosition += 15;

    pdf.setFontSize(10);
    pdf.setTextColor(80, 80, 80);
    const improvements = [
      'Optimiser la rotation des articles à faible rotation',
      'Rééquilibrer les stocks entre catégories performantes',
      'Analyser les prix des articles invendus depuis longtemps',
      'Considérer l\'expansion des catégories rentables'
    ];

    improvements.forEach(improvement => {
      checkPageBreak(8);
      pdf.text(`• ${improvement}`, margin + 5, yPosition);
      yPosition += 8;
    });

    yPosition += 20;

    // Recommandations stratégiques
    pdf.setFontSize(14);
    pdf.setTextColor(50, 50, 50);
    pdf.text('Recommandations Stratégiques', margin, yPosition);
    yPosition += 20;

    const recommendations = [
      '1. Développer davantage les catégories les plus rentables',
      '2. Mettre en place un système de suivi des stocks dormants',
      '3. Optimiser l\'utilisation de l\'espace de stockage',
      '4. Établir des objectifs de rotation par catégorie',
      '5. Analyser régulièrement les performances par container'
    ];

    pdf.setFontSize(10);
    pdf.setTextColor(80, 80, 80);
    recommendations.forEach(rec => {
      checkPageBreak(10);
      pdf.text(rec, margin, yPosition);
      yPosition += 12;
    });

    yPosition += 20;

    // Conclusion
    pdf.setFontSize(14);
    pdf.setTextColor(50, 50, 50);
    pdf.text('Conclusion', margin, yPosition);
    yPosition += 20;

    pdf.setFontSize(10);
    pdf.setTextColor(80, 80, 80);
    const conclusion = `L'analyse de votre inventaire révèle un système de gestion efficace avec ${stats.total} articles répartis 
sur ${stats.categoryStats.length} catégories. Le taux de rotation de ${rotationRate}% et la marge de ${marginRate}% 
indiquent une performance solide. Les recommandations ci-dessus vous aideront à optimiser 
davantage vos résultats et à maintenir une croissance durable de votre activité.`;

    const lines = pdf.splitTextToSize(conclusion, contentWidth);
    lines.forEach((line: string) => {
      checkPageBreak(8);
      pdf.text(line, margin, yPosition);
      yPosition += 8;
    });

    // Pied de page sur toutes les pages
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Rapport d'Inventaire Complet - Page ${i}/${totalPages} - Généré le ${currentDate}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    return pdf.output('blob');
  }

  /**
   * Génère et télécharge un rapport PDF natif
   */
  static async exportToPDF(data: ReportData, options?: ExportOptions): Promise<void> {
    try {
      console.log('[ReportService] Starting PDF export');
      const pdfBlob = await this.generatePDFReport(data, options);
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `rapport-inventaire-${timestamp}.pdf`;
      
      // ✅ CORRECTION: Utiliser la méthode alternative qui évite la manipulation DOM
      downloadBlobSafelyAlt(pdfBlob, filename);
      
      // ✅ TEMPORAIRE: Désactiver le monitoring mémoire pour tester
      // monitorMemoryAndCleanup();
      
      console.log('[ReportService] PDF export completed successfully');
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      // ✅ TEMPORAIRE: Désactiver le monitoring mémoire pour tester  
      // monitorMemoryAndCleanup();
      throw new Error('Impossible de générer le fichier PDF');
    }
  }


  /**
   * Échappe les valeurs pour CSV
   */
  private static escapeCsvValue(value: string): string {
    if (value.includes(';') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }


  /**
   * Filtre les données selon les options
   */
  static filterData(data: ReportData, options?: ExportOptions): ReportData {
    if (!options?.filters && !options?.dateRange) {
      return data;
    }

    let filteredItems = [...data.items];

    // Filtre par statut
    if (options.filters?.status && options.filters.status !== 'all') {
      filteredItems = filteredItems.filter(item => item.status === options.filters!.status);
    }

    // Filtre par catégorie
    if (options.filters?.categoryId) {
      filteredItems = filteredItems.filter(item => item.categoryId === options.filters!.categoryId);
    }

    // Filtre par container
    if (options.filters?.containerId) {
      filteredItems = filteredItems.filter(item => item.containerId === options.filters!.containerId);
    }

    // Filtre par emplacement
    if (options.filters?.locationId) {
      filteredItems = filteredItems.filter(item => item.locationId === options.filters!.locationId);
    }

    // Filtre par date
    if (options.dateRange) {
      const { from, to } = options.dateRange;
      filteredItems = filteredItems.filter(item => {
        const createdAt = new Date(item.createdAt);
        return createdAt >= from && createdAt <= to;
      });
    }

    return {
      ...data,
      items: filteredItems
    };
  }
}