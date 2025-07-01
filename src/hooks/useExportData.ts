import { useState, useCallback } from 'react';
import { ReportService, ReportData, ExportOptions } from '../services/ReportService';

export const useExportData = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportWithData = useCallback(async (
    format: 'csv' | 'pdf' | 'html',
    data: ReportData,
    options?: Partial<ExportOptions>
  ) => {
    setIsExporting(true);
    setExportError(null);

    try {
      // Créer les options complètes avec le format
      const fullOptions: ExportOptions = {
        format,
        ...options,
      };

      // Filtrer les données selon les options
      const filteredData = options?.filters 
        ? ReportService.filterData(data, fullOptions) 
        : data;

      // Exporter selon le format
      switch (format) {
        case 'csv':
          await ReportService.exportToCSV(filteredData, fullOptions);
          break;
        case 'pdf':
          await ReportService.exportToPDF(filteredData, fullOptions);
          break;
        case 'html':
          await ReportService.exportToHTML(filteredData, fullOptions);
          break;
        default:
          throw new Error(`Format d'export non supporté: ${format}`);
      }

    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      setExportError(error instanceof Error ? error.message : 'Erreur d\'export inconnue');
    } finally {
      setIsExporting(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setExportError(null);
  }, []);

  return {
    isExporting,
    exportError,
    exportWithData,
    clearError,
  };
};