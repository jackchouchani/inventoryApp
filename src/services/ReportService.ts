import { Item } from '../types/item';
import { Category } from '../types/category';
import { Container } from '../types/container';
import { Location } from '../types/location';

// Import jsPDF dynamically for web compatibility
let jsPDF: any = null;

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
  format: 'csv' | 'pdf' | 'html';
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
      filteredItems = data.items.filter(item => item.status === options.csvStatusFilter);
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
   * Génère un fichier HTML enrichi pour le rapport d'inventaire
   */
  static generateHTMLReport(data: ReportData, _options?: ExportOptions): string {
    const stats = this.generateStats(data);
    const currentDate = new Date().toLocaleDateString('fr-FR');
    const currentTime = new Date().toLocaleTimeString('fr-FR');
    
    // Calculs avancés
    const rotationRate = stats.total > 0 ? ((stats.sold / stats.total) * 100).toFixed(1) : '0';
    const avgMargin = stats.soldValue > 0 ? (((stats.soldValue - stats.sold * (stats.totalValue / stats.total)) / stats.soldValue) * 100).toFixed(1) : '0';
    
    // Top et bottom performers
    const sortedCategories = stats.categoryStats.sort((a: any, b: any) => b.value - a.value);
    const topCategory = sortedCategories[0];
    const bottomCategory = sortedCategories[sortedCategories.length - 1];
    
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport d'Inventaire Détaillé - ${currentDate}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
            position: relative;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="1" fill="white" opacity="0.1"/><circle cx="80" cy="80" r="1" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
            opacity: 0.3;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            position: relative;
            z-index: 1;
        }
        
        .header p {
            font-size: 1.1em;
            opacity: 0.9;
            position: relative;
            z-index: 1;
        }
        
        .content {
            padding: 40px;
        }
        
        .summary-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 25px;
            margin-bottom: 40px;
        }
        
        .card {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.08);
            border-left: 4px solid #667eea;
            transition: transform 0.3s ease;
        }
        
        .card:hover {
            transform: translateY(-5px);
        }
        
        .card-header {
            display: flex;
            align-items: center;
            margin-bottom: 15px;
        }
        
        .card-icon {
            width: 50px;
            height: 50px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 15px;
            font-size: 1.5em;
        }
        
        .card-title {
            font-size: 1.1em;
            color: #667eea;
            font-weight: 600;
        }
        
        .card-value {
            font-size: 2.5em;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 5px;
        }
        
        .card-subtitle {
            color: #718096;
            font-size: 0.9em;
        }
        
        .section {
            margin-bottom: 40px;
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.05);
        }
        
        .section-title {
            font-size: 1.8em;
            color: #2d3748;
            margin-bottom: 25px;
            padding-bottom: 10px;
            border-bottom: 3px solid #667eea;
            display: flex;
            align-items: center;
        }
        
        .section-title::before {
            content: '📊';
            margin-right: 10px;
            font-size: 1.2em;
        }
        
        .performance-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        
        .performance-card {
            padding: 20px;
            border-radius: 10px;
            text-align: center;
        }
        
        .performance-card.best {
            background: linear-gradient(135deg, #48bb78, #38a169);
            color: white;
        }
        
        .performance-card.worst {
            background: linear-gradient(135deg, #fc8181, #e53e3e);
            color: white;
        }
        
        .performance-value {
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .performance-label {
            font-size: 0.9em;
            opacity: 0.9;
        }
        
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        
        .data-table th {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 15px 12px;
            text-align: left;
            font-weight: 600;
            font-size: 0.95em;
        }
        
        .data-table td {
            padding: 12px;
            border-bottom: 1px solid #e2e8f0;
            background: white;
        }
        
        .data-table tr:nth-child(even) td {
            background: #f7fafc;
        }
        
        .data-table tr:hover td {
            background: #edf2f7;
        }
        
        .progress-bar {
            height: 8px;
            background: #e2e8f0;
            border-radius: 4px;
            margin-top: 5px;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            border-radius: 4px;
            transition: width 0.3s ease;
        }
        
        .footer {
            background: #f7fafc;
            padding: 30px;
            text-align: center;
            color: #718096;
            border-top: 1px solid #e2e8f0;
        }
        
        .highlight {
            background: linear-gradient(120deg, #a8edea 0%, #fed6e3 100%);
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
        }
        
        .metric {
            display: inline-block;
            margin: 0 15px;
            text-align: center;
        }
        
        .metric-value {
            font-size: 1.5em;
            font-weight: bold;
            color: #667eea;
        }
        
        .metric-label {
            font-size: 0.8em;
            color: #718096;
            margin-top: 5px;
        }
        
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; }
            .card:hover { transform: none; }
        }
        
        @media (max-width: 768px) {
            .performance-grid { grid-template-columns: 1fr; }
            .summary-cards { grid-template-columns: 1fr; }
            .content { padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📦 Rapport d'Inventaire Détaillé</h1>
            <p>Généré le ${currentDate} à ${currentTime}</p>
        </div>

        <div class="content">
            <!-- Résumé Exécutif -->
            <div class="highlight">
                <h3 style="margin-bottom: 15px; color: #2d3748;">📈 Résumé Exécutif</h3>
                <div class="metric">
                    <div class="metric-value">${rotationRate}%</div>
                    <div class="metric-label">Taux de Rotation</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${avgMargin}%</div>
                    <div class="metric-label">Marge Moyenne</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${stats.avgPrice.toLocaleString('fr-FR')} €</div>
                    <div class="metric-label">Prix Moyen</div>
                </div>
            </div>

            <!-- Cartes de Résumé -->
            <div class="summary-cards">
                <div class="card">
                    <div class="card-header">
                        <div class="card-icon" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white;">📦</div>
                        <div class="card-title">Articles Total</div>
                    </div>
                    <div class="card-value">${stats.total}</div>
                    <div class="card-subtitle">Inventaire complet</div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <div class="card-icon" style="background: linear-gradient(135deg, #48bb78, #38a169); color: white;">✅</div>
                        <div class="card-title">Disponibles</div>
                    </div>
                    <div class="card-value">${stats.available}</div>
                    <div class="card-subtitle">${stats.availableValue.toLocaleString('fr-FR')} € de valeur</div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <div class="card-icon" style="background: linear-gradient(135deg, #fc8181, #e53e3e); color: white;">💰</div>
                        <div class="card-title">Vendus</div>
                    </div>
                    <div class="card-value">${stats.sold}</div>
                    <div class="card-subtitle">${stats.soldValue.toLocaleString('fr-FR')} € de CA</div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <div class="card-icon" style="background: linear-gradient(135deg, #ed8936, #dd6b20); color: white;">💎</div>
                        <div class="card-title">Valeur Totale</div>
                    </div>
                    <div class="card-value">${stats.totalValue.toLocaleString('fr-FR')} €</div>
                    <div class="card-subtitle">Valorisation complète</div>
                </div>
            </div>

            <!-- Performance par Catégorie -->
            ${topCategory && bottomCategory ? `
            <div class="section">
                <div class="section-title">🏆 Performance des Catégories</div>
                <div class="performance-grid">
                    <div class="performance-card best">
                        <div class="performance-value">${topCategory.name}</div>
                        <div class="performance-label">Meilleure Catégorie</div>
                        <div style="margin-top: 10px; font-size: 1.2em;">${topCategory.value.toLocaleString('fr-FR')} €</div>
                    </div>
                    <div class="performance-card worst">
                        <div class="performance-value">${bottomCategory.name}</div>
                        <div class="performance-label">À Améliorer</div>
                        <div style="margin-top: 10px; font-size: 1.2em;">${bottomCategory.value.toLocaleString('fr-FR')} €</div>
                    </div>
                </div>
            </div>
            ` : ''}

            <!-- Détail par Catégorie -->
            <div class="section">
                <div class="section-title">📋 Répartition Détaillée par Catégorie</div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Catégorie</th>
                            <th>Total</th>
                            <th>Disponibles</th>
                            <th>Vendus</th>
                            <th>Valeur (€)</th>
                            <th>Performance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stats.categoryStats.map((cat: any) => {
                          const percentage = stats.totalValue > 0 ? ((cat.value / stats.totalValue) * 100) : 0;
                          return `
                            <tr>
                                <td><strong>${cat.name}</strong></td>
                                <td>${cat.count}</td>
                                <td>${cat.available}</td>
                                <td>${cat.sold}</td>
                                <td><strong>${cat.value.toLocaleString('fr-FR')} €</strong></td>
                                <td>
                                    <div>${percentage.toFixed(1)}%</div>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${percentage}%"></div>
                                    </div>
                                </td>
                            </tr>
                          `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <!-- Liste des Articles -->
            <div class="section">
                <div class="section-title">📝 Liste Complète des Articles</div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nom</th>
                            <th>Statut</th>
                            <th>Prix Achat</th>
                            <th>Prix Vente</th>
                            <th>Catégorie</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.items.slice(0, 50).map(item => { // Limite à 50 pour éviter un fichier trop lourd
                          const category = data.categories.find(c => c.id === item.categoryId);
                          return `
                            <tr>
                                <td>${item.id}</td>
                                <td><strong>${item.name}</strong></td>
                                <td>
                                    <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.8em; ${item.status === 'available' ? 'background: #c6f6d5; color: #22543d;' : 'background: #fed7d7; color: #742a2a;'}">
                                        ${item.status === 'available' ? 'Disponible' : 'Vendu'}
                                    </span>
                                </td>
                                <td>${item.purchasePrice.toLocaleString('fr-FR')} €</td>
                                <td>${item.sellingPrice.toLocaleString('fr-FR')} €</td>
                                <td>${category?.name || 'N/A'}</td>
                            </tr>
                          `;
                        }).join('')}
                        ${data.items.length > 50 ? `
                        <tr>
                            <td colspan="6" style="text-align: center; color: #718096; font-style: italic; padding: 20px;">
                                ... et ${data.items.length - 50} autres articles
                            </td>
                        </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="footer">
            <p>📊 Rapport généré automatiquement par l'application de gestion d'inventaire</p>
            <p style="margin-top: 10px; font-size: 0.9em;">
                Total de ${data.items.length} articles • ${data.categories.length} catégories • ${data.containers.length} containers
            </p>
        </div>
    </div>
</body>
</html>`;

    return html;
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
      const csvContent = this.generateCSV(data, options);
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `inventaire-${timestamp}.csv`;
      
      this.downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
    } catch (error) {
      console.error('Erreur lors de l\'export CSV:', error);
      throw new Error('Impossible de générer le fichier CSV');
    }
  }

  /**
   * Génère un PDF simple avec jsPDF (sans autoTable)
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
    let yPosition = margin;

    // Fonction pour ajouter une nouvelle page si nécessaire
    const checkPageBreak = (requiredHeight: number) => {
      if (yPosition + requiredHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
    };

    // En-tête du document
    pdf.setFontSize(24);
    pdf.setTextColor(51, 51, 51);
    pdf.text('Rapport d\'Inventaire', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    pdf.setFontSize(12);
    pdf.setTextColor(102, 102, 102);
    pdf.text(`Généré le ${currentDate} à ${currentTime}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;

    // Ligne de séparation
    pdf.setDrawColor(102, 126, 234);
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 15;

    // Résumé exécutif
    checkPageBreak(40);
    pdf.setFontSize(16);
    pdf.setTextColor(51, 51, 51);
    pdf.text('Resume Executif', margin, yPosition);
    yPosition += 15;

    const rotationRate = stats.total > 0 ? ((stats.sold / stats.total) * 100).toFixed(1) : '0';
    
    pdf.setFontSize(12);
    pdf.setTextColor(102, 126, 234);
    pdf.text(`Taux de rotation: ${rotationRate}%`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Prix moyen: ${stats.avgPrice.toLocaleString('fr-FR')} euros`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Articles total: ${stats.total}`, margin, yPosition);
    yPosition += 20;

    // Statistiques générales
    checkPageBreak(80);
    pdf.setFontSize(14);
    pdf.setTextColor(51, 51, 51);
    pdf.text('Statistiques Generales', margin, yPosition);
    yPosition += 15;

    // Tableau simple sans autoTable
    pdf.setFontSize(10);
    const statsInfo = [
      `Articles Total: ${stats.total}`,
      `Articles Disponibles: ${stats.available}`,
      `Articles Vendus: ${stats.sold}`,
      `Valeur Stock: ${stats.availableValue.toLocaleString('fr-FR')} euros`,
      `Chiffre d'Affaires: ${stats.soldValue.toLocaleString('fr-FR')} euros`,
      `Valeur Totale: ${stats.totalValue.toLocaleString('fr-FR')} euros`
    ];

    statsInfo.forEach(info => {
      checkPageBreak(10);
      pdf.text(info, margin, yPosition);
      yPosition += 8;
    });

    yPosition += 15;

    // Performance par catégorie
    if (stats.categoryStats.length > 0) {
      checkPageBreak(60);
      pdf.setFontSize(14);
      pdf.setTextColor(51, 51, 51);
      pdf.text('Performance par Categorie', margin, yPosition);
      yPosition += 15;

      pdf.setFontSize(10);
      stats.categoryStats.slice(0, 10).forEach((cat: any) => {
        checkPageBreak(8);
        const percentage = stats.totalValue > 0 ? ((cat.value / stats.totalValue) * 100).toFixed(1) : '0';
        pdf.text(`${cat.name}: ${cat.count} articles (${percentage}%) - ${cat.value.toLocaleString('fr-FR')} euros`, margin, yPosition);
        yPosition += 8;
      });

      yPosition += 15;
    }

    // Top articles
    const topItems = data.items.slice(0, 15);
    if (topItems.length > 0) {
      checkPageBreak(60);
      pdf.setFontSize(14);
      pdf.setTextColor(51, 51, 51);
      pdf.text('Top 15 Articles', margin, yPosition);
      yPosition += 15;

      pdf.setFontSize(9);
      topItems.forEach(item => {
        checkPageBreak(8);
        const itemText = `${item.id}. ${item.name.substring(0, 30)} - ${item.sellingPrice} euros (${item.status === 'available' ? 'Dispo' : 'Vendu'})`;
        pdf.text(itemText, margin, yPosition);
        yPosition += 7;
      });
    }

    // Pied de page
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Page ${i}/${totalPages} - Genere le ${currentDate}`,
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
      const pdfBlob = await this.generatePDFReport(data, options);
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `rapport-inventaire-${timestamp}.pdf`;
      
      // Créer un lien de téléchargement
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Nettoyage
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      throw new Error('Impossible de générer le fichier PDF');
    }
  }

  /**
   * Génère et télécharge un rapport HTML (pour preview)
   */
  static async exportToHTML(data: ReportData, options?: ExportOptions): Promise<void> {
    try {
      const htmlContent = this.generateHTMLReport(data, options);
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `rapport-inventaire-${timestamp}.html`;
      
      this.downloadFile(htmlContent, filename, 'text/html;charset=utf-8;');
    } catch (error) {
      console.error('Erreur lors de l\'export HTML:', error);
      throw new Error('Impossible de générer le fichier HTML');
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