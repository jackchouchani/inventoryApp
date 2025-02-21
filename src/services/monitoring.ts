import * as Application from 'expo-application';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sentry from '@sentry/react-native';
import { QueryClient } from '@tanstack/react-query';

// Configuration améliorée de Sentry
Sentry.init({
  dsn: "https://e85c4ce807fa31bfd2016b812597ce21@o4507964870819840.ingest.us.sentry.io/4507964871081984",
  enableAutoSessionTracking: true,
  sessionTrackingIntervalMillis: 30000,
  attachStacktrace: true,
  debug: false, // Désactiver le mode debug
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: __DEV__ ? 1.0 : 0.1, // Réduire le taux d'échantillonnage en prod
  enableNative: Platform.OS !== 'web',
  maxBreadcrumbs: 10, // Réduire encore plus pour limiter les logs
  maxValueLength: 150, // Réduire encore plus
  normalizeDepth: 2,
  beforeSend(event) {
    // Ne pas envoyer d'événements en développement
    if (__DEV__) return null;

    // Ignorer les événements non critiques en production
    if (!event.exception && event.level !== 'error') return null;

    // Limiter la taille des contexts/extra
    if (event.contexts?.performance) {
      event.contexts.performance = truncateObject(event.contexts.performance, 50);
    }
    if (event.extra) {
      event.extra = truncateObject(event.extra, 50);
    }

    // Supprimer les headers sensibles
    if (event.request?.headers) {
      delete event.request.headers.Authorization;
      delete event.request.headers.authorization;
    }

    Sentry.setTag('platform', Platform.OS);
    Sentry.setTag('appVersion', Application.nativeApplicationVersion || 'unknown');
    Sentry.setTag('buildNumber', Application.nativeBuildVersion || 'unknown');

    return event;
  },
});

// Fonction utilitaire pour tronquer les objets
function truncateObject(obj: any, maxLength: number): any {
  if (!obj || typeof obj !== 'object') return obj;
  const result: any = {};
  for (const key in obj) {
    if (typeof obj[key] === 'string' && obj[key].length > maxLength) {
      result[key] = obj[key].substring(0, maxLength) + '...';
    } else if (typeof obj[key] === 'object') {
      result[key] = truncateObject(obj[key], maxLength);
    } else {
      result[key] = obj[key];
    }
  }
  return result;
}

interface PerformanceMetric {
  type: 'RENDER' | 'API_CALL' | 'DB_OPERATION' | 'IMAGE_LOAD';
  name: string;
  duration: number;
  timestamp: number;
  table_name?: string;
  record_id?: number;
  operation?: string;
  old_data?: any;
  new_data?: any;
}

interface ErrorEvent {
  type: 'API_ERROR' | 'DB_ERROR' | 'RENDER_ERROR' | 'SYNC_ERROR';
  message: string;
  stack?: string;
  timestamp: number;
  table_name?: string;
  record_id?: number;
  operation?: string;
  old_data?: any;
  new_data?: any;
}

interface PerformanceThresholds {
  render: number;
  apiCall: number;
  dbOperation: number;
  imageLoad: number;
}

interface PerformanceData {
  summary: {
    apiCalls: { count: number; averageDuration: number; errors: number };
    renders: { count: number; averageDuration: number; errors: number };
    dbOperations: { count: number; averageDuration: number; errors: number };
  };
  slowestOperations: Array<{
    type: string;
    name: string;
    duration: number;
  }>;
  errorRate: {
    api: number;
    render: number;
    db: number;
  };
  performanceScore: number;
}

class MonitoringService {
  private static instance: MonitoringService;
  private metrics: PerformanceMetric[] = [];
  private errors: ErrorEvent[] = [];
  private readonly MAX_STORED_EVENTS = 1000;
  private readonly LOGS_DIRECTORY = Platform.OS !== 'web' ? `${FileSystem.documentDirectory}logs/` : null;
  private performanceThresholds: PerformanceThresholds = {
    render: 16, // ms (pour 60 FPS)
    apiCall: 1000, // ms
    dbOperation: 100, // ms
    imageLoad: 500, // ms
  };
  private queryClient: QueryClient | null = null;
  private apiMetrics: Map<string, { duration: number; success: boolean }[]> = new Map();
  private renderMetrics: Map<string, { duration: number; success: boolean }[]> = new Map();
  private dbMetrics: Map<string, { duration: number; success: boolean }[]> = new Map();

  private constructor() {
    if (Platform.OS !== 'web') {
      this.initializeLogsDirectory();
    }
    this.setupSentryScope();
  }

  private setupSentryScope() {
    // Configurer les tags globaux
    Sentry.setTag('platform', Platform.OS);
    if (Platform.OS !== 'web') {
      Sentry.setTag('appVersion', Application.nativeApplicationVersion || 'unknown');
      Sentry.setTag('buildVersion', Application.nativeBuildVersion || 'unknown');
    }
  }

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  setPerformanceThresholds(thresholds: Partial<PerformanceThresholds>) {
    this.performanceThresholds = {
      ...this.performanceThresholds,
      ...thresholds,
    };
  }

  private async initializeLogsDirectory() {
    if (!this.LOGS_DIRECTORY) return;
    
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.LOGS_DIRECTORY);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.LOGS_DIRECTORY);
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du dossier de logs:', error);
    }
  }

  async recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>) {
    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: Date.now()
    };

    this.metrics.push(fullMetric);
    this.checkPerformanceThreshold(fullMetric);

    // Enregistrer la métrique comme un événement Sentry
    Sentry.addBreadcrumb({
      category: 'performance',
      message: `${metric.type}: ${metric.name}`,
      data: {
        duration: metric.duration,
        table_name: metric.table_name,
        record_id: metric.record_id,
        operation: metric.operation,
        old_data: metric.old_data,
        new_data: metric.new_data
      },
      level: 'info',
    });

    if (this.metrics.length > this.MAX_STORED_EVENTS) {
      await this.flushMetrics();
    }
  }

  private checkPerformanceThreshold(metric: PerformanceMetric) {
    let threshold: number;
    switch (metric.type) {
      case 'RENDER':
        threshold = this.performanceThresholds.render;
        break;
      case 'API_CALL':
        threshold = this.performanceThresholds.apiCall;
        break;
      case 'DB_OPERATION':
        threshold = this.performanceThresholds.dbOperation;
        break;
      case 'IMAGE_LOAD':
        threshold = this.performanceThresholds.imageLoad;
        break;
      default:
        return;
    }

    if (metric.duration > threshold) {
      Sentry.captureMessage(
        `Performance threshold exceeded for ${metric.type}`,
        {
          level: 'warning',
          contexts: {
            performance: {
              type: metric.type,
              name: metric.name,
              duration: metric.duration,
              threshold,
              table_name: metric.table_name,
              record_id: metric.record_id,
              operation: metric.operation,
              old_data: metric.old_data,
              new_data: metric.new_data
            },
          },
        }
      );
    }
  }

  async recordError(error: Omit<ErrorEvent, 'timestamp'>) {
    const fullError: ErrorEvent = {
      ...error,
      timestamp: Date.now()
    };

    this.errors.push(fullError);

    // Envoyer à Sentry
    Sentry.captureException(new Error(error.message), {
      contexts: {
        error: {
          type: error.type,
          table_name: error.table_name,
          record_id: error.record_id,
          operation: error.operation,
          old_data: error.old_data,
          new_data: error.new_data
        },
      },
      extra: {
        table_name: error.table_name,
        record_id: error.record_id,
        operation: error.operation,
        old_data: error.old_data,
        new_data: error.new_data
      },
    });

    if (this.errors.length > this.MAX_STORED_EVENTS) {
      await this.flushErrors();
    }

    if (error.type === 'API_ERROR' || error.type === 'DB_ERROR') {
      await this.sendErrorReport(fullError);
    }
  }

  startPerformanceTransaction(name: string, operation: string) {
    // Créer un breadcrumb pour le début de la transaction
    Sentry.addBreadcrumb({
      category: 'performance',
      message: `Starting transaction: ${name}`,
      data: { operation },
      level: 'info',
    });
  }

  private async flushMetrics() {
    if (Platform.OS === 'web') {
      this.metrics = [];
      return;
    }

    try {
      const filename = `metrics_${Date.now()}.json`;
      const filePath = `${this.LOGS_DIRECTORY}${filename}`;
      
      await FileSystem.writeAsStringAsync(
        filePath,
        JSON.stringify(this.metrics),
        { encoding: FileSystem.EncodingType.UTF8 }
      );

      this.metrics = [];
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des métriques:', error);
      this.metrics = [];
    }
  }

  private async flushErrors() {
    if (Platform.OS === 'web') {
      this.errors = [];
      return;
    }

    try {
      const filename = `errors_${Date.now()}.json`;
      const filePath = `${this.LOGS_DIRECTORY}${filename}`;
      
      await FileSystem.writeAsStringAsync(
        filePath,
        JSON.stringify(this.errors),
        { encoding: FileSystem.EncodingType.UTF8 }
      );

      this.errors = [];
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des erreurs:', error);
      this.errors = [];
    }
  }

  private async sendErrorReport(error: ErrorEvent) {
    const deviceInfo = {
      platform: Platform.OS,
      version: Platform.Version,
      ...(Platform.OS !== 'web' ? {
        appVersion: Application.nativeApplicationVersion,
        buildVersion: Application.nativeBuildVersion,
      } : {})
    };

    // TODO: Implémenter l'envoi au service de monitoring
    console.error('Erreur critique:', {
      ...error,
      deviceInfo
    });
  }

  async getMetricsSummary() {
    const summary = {
      apiCalls: {
        count: 0,
        averageDuration: 0,
        errors: 0
      },
      renders: {
        count: 0,
        averageDuration: 0,
        errors: 0
      },
      dbOperations: {
        count: 0,
        averageDuration: 0,
        errors: 0
      }
    };

    this.metrics.forEach(metric => {
      switch (metric.type) {
        case 'API_CALL':
          summary.apiCalls.count++;
          summary.apiCalls.averageDuration += metric.duration;
          break;
        case 'RENDER':
          summary.renders.count++;
          summary.renders.averageDuration += metric.duration;
          break;
        case 'DB_OPERATION':
          summary.dbOperations.count++;
          summary.dbOperations.averageDuration += metric.duration;
          break;
      }
    });

    // Calculer les moyennes
    if (summary.apiCalls.count > 0) {
      summary.apiCalls.averageDuration /= summary.apiCalls.count;
    }
    if (summary.renders.count > 0) {
      summary.renders.averageDuration /= summary.renders.count;
    }
    if (summary.dbOperations.count > 0) {
      summary.dbOperations.averageDuration /= summary.dbOperations.count;
    }

    // Compter les erreurs
    this.errors.forEach(error => {
      switch (error.type) {
        case 'API_ERROR':
          summary.apiCalls.errors++;
          break;
        case 'RENDER_ERROR':
          summary.renders.errors++;
          break;
        case 'DB_ERROR':
          summary.dbOperations.errors++;
          break;
      }
    });

    return summary;
  }

  async cleanup() {
    await Promise.all([
      this.flushMetrics(),
      this.flushErrors()
    ]);
  }

  async getPerformanceReport(): Promise<PerformanceData> {
    const apiMetrics = this.calculateMetrics(this.apiMetrics);
    const renderMetrics = this.calculateMetrics(this.renderMetrics);
    const dbMetrics = this.calculateMetrics(this.dbMetrics);

    // Calculer les opérations les plus lentes
    const allOperations = [
      ...apiMetrics.operations.map(op => ({ ...op, type: 'API' })),
      ...renderMetrics.operations.map(op => ({ ...op, type: 'Rendu' })),
      ...dbMetrics.operations.map(op => ({ ...op, type: 'BD' })),
    ].sort((a, b) => b.duration - a.duration).slice(0, 5);

    // Calculer les taux d'erreur
    const calculateErrorRate = (metrics: ReturnType<typeof this.calculateMetrics>) => 
      metrics.count > 0 ? (metrics.errors / metrics.count) * 100 : 0;

    // Calculer le score de performance global
    const performanceScore = 100 - (
      (calculateErrorRate(apiMetrics) +
       calculateErrorRate(renderMetrics) +
       calculateErrorRate(dbMetrics)) / 3
    );

    return {
      summary: {
        apiCalls: {
          count: apiMetrics.count,
          averageDuration: Math.round(apiMetrics.averageDuration),
          errors: apiMetrics.errors,
        },
        renders: {
          count: renderMetrics.count,
          averageDuration: Math.round(renderMetrics.averageDuration),
          errors: renderMetrics.errors,
        },
        dbOperations: {
          count: dbMetrics.count,
          averageDuration: Math.round(dbMetrics.averageDuration),
          errors: dbMetrics.errors,
        },
      },
      slowestOperations: allOperations.map(op => ({
        type: op.type,
        name: op.name,
        duration: Math.round(op.duration),
      })),
      errorRate: {
        api: Math.round(calculateErrorRate(apiMetrics) * 10) / 10,
        render: Math.round(calculateErrorRate(renderMetrics) * 10) / 10,
        db: Math.round(calculateErrorRate(dbMetrics) * 10) / 10,
      },
      performanceScore: Math.round(performanceScore * 10) / 10,
    };
  }

  private calculateMetrics(metrics: Map<string, { duration: number; success: boolean }[]>) {
    let totalCount = 0;
    let totalDuration = 0;
    let errorCount = 0;
    const operations: { name: string; duration: number }[] = [];

    metrics.forEach((calls, name) => {
      totalCount += calls.length;
      const totalCallDuration = calls.reduce((sum, call) => sum + call.duration, 0);
      totalDuration += totalCallDuration;
      errorCount += calls.filter(call => !call.success).length;
      
      operations.push({
        name,
        duration: totalCallDuration / calls.length,
      });
    });

    return {
      count: totalCount,
      averageDuration: totalCount > 0 ? totalDuration / totalCount : 0,
      errors: errorCount,
      operations,
    };
  }

  setQueryClient(client: QueryClient) {
    this.queryClient = client;
  }

  trackApiCall(name: string, duration: number, success: boolean) {
    const metrics = this.apiMetrics.get(name) || [];
    metrics.push({ duration, success });
    this.apiMetrics.set(name, metrics);
    
    if (!success) {
      Sentry.addBreadcrumb({
        category: 'api',
        message: `API call failed: ${name}`,
        level: 'error',
      });
    }
  }

  trackRender(componentName: string, duration: number, success: boolean) {
    const metrics = this.renderMetrics.get(componentName) || [];
    metrics.push({ duration, success });
    this.renderMetrics.set(componentName, metrics);
  }

  trackDbOperation(operation: string, duration: number, success: boolean) {
    const metrics = this.dbMetrics.get(operation) || [];
    metrics.push({ duration, success });
    this.dbMetrics.set(operation, metrics);
    
    if (!success) {
      Sentry.addBreadcrumb({
        category: 'database',
        message: `Database operation failed: ${operation}`,
        level: 'error',
      });
    }
  }

  clearMetrics() {
    this.apiMetrics.clear();
    this.renderMetrics.clear();
    this.dbMetrics.clear();
  }
}

export const monitoring = MonitoringService.getInstance();

// Hook pour mesurer le temps de rendu des composants
export function usePerformanceMonitoring(componentName: string) {
  return {
    logRender: (duration: number) => {
      monitoring.recordMetric({
        type: 'RENDER',
        name: componentName,
        duration
      });
    }
  };
}

export const logPerformanceMetric = (metric: Omit<PerformanceMetric, "timestamp">) => {
  const timestamp = Date.now();
  const fullMetric = {
    ...metric,
    timestamp,
  };
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Performance Metric:', fullMetric);
  }
  
  // Send to monitoring service
  monitoring.recordMetric(fullMetric);
};

export const logError = (error: Omit<ErrorEvent, "timestamp">) => {
  const timestamp = Date.now();
  const fullError = {
    ...error,
    timestamp,
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error Event:', fullError);
  }

  // Send to monitoring service
  monitoring.recordError(fullError);
};

const recordMetric = (metric: PerformanceMetric) => {
  try {
    const metricData = {
      type: metric.type,
      name: metric.name,
      duration: metric.duration,
      timestamp: metric.timestamp,
      table_name: metric.table_name,
      record_id: metric.record_id,
      operation: metric.operation,
      old_data: metric.old_data,
      new_data: metric.new_data
    };

    // Send to monitoring service
    monitoring.recordMetric(metricData);
  } catch (error) {
    console.error('Failed to record metric:', error);
  }
};

const recordError = (error: ErrorEvent) => {
  try {
    const errorData = {
      type: error.type,
      message: error.message,
      stack: error.stack,
      timestamp: error.timestamp,
      table_name: error.table_name,
      record_id: error.record_id,
      operation: error.operation,
      old_data: error.old_data,
      new_data: error.new_data
    };

    // Send to monitoring service
    monitoring.recordError(errorData);
  } catch (err) {
    console.error('Failed to record error:', err);
  }
};

export const measurePerformance = async <T>(
  type: PerformanceMetric['type'],
  name: string,
  operation: () => Promise<T>,
  context?: {
    table_name?: string;
    record_id?: number;
    operation?: string;
    old_data?: any;
    new_data?: any;
  }
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await operation();
    const duration = performance.now() - start;
    
    logPerformanceMetric({
      type,
      name,
      duration,
      table_name: context?.table_name,
      record_id: context?.record_id,
      operation: context?.operation,
      old_data: context?.old_data,
      new_data: context?.new_data
    });
    
    return result;
  } catch (err) {
    const error = err as Error;
    
    logError({
      type: 'API_ERROR',
      message: error.message || 'Unknown error occurred',
      stack: error.stack,
      table_name: context?.table_name,
      record_id: context?.record_id,
      operation: context?.operation,
      old_data: context?.old_data,
      new_data: context?.new_data
    });
    
    throw error;
  }
}; 