import * as Application from 'expo-application';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sentry from '@sentry/react-native';

// Configuration améliorée de Sentry
Sentry.init({
  dsn: "https://e85c4ce807fa31bfd2016b812597ce21@o4507964870819840.ingest.us.sentry.io/4507964871081984",
  enableAutoSessionTracking: true,
  sessionTrackingIntervalMillis: 30000,
  attachStacktrace: true,
  debug: __DEV__,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: 1.0,
  enableNative: Platform.OS !== 'web',
  beforeSend(event) {
    if (event.exception) {
      Sentry.setTag('platform', Platform.OS);
      Sentry.setTag('appVersion', Application.nativeApplicationVersion || 'unknown');
    }
    return event;
  }
});

interface PerformanceMetric {
  type: 'RENDER' | 'API_CALL' | 'DB_OPERATION' | 'IMAGE_LOAD';
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface ErrorEvent {
  type: 'API_ERROR' | 'DB_ERROR' | 'RENDER_ERROR' | 'SYNC_ERROR';
  message: string;
  stack?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface PerformanceThresholds {
  render: number;
  apiCall: number;
  dbOperation: number;
  imageLoad: number;
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
        ...metric.metadata,
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
              metadata: metric.metadata,
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
          metadata: error.metadata,
        },
      },
      extra: {
        ...error.metadata,
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

  async getPerformanceReport() {
    const summary = await this.getMetricsSummary();
    const slowestOperations = this.metrics
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    const report = {
      summary,
      slowestOperations,
      errorRate: {
        api: this.getErrorRate('API_ERROR'),
        render: this.getErrorRate('RENDER_ERROR'),
        db: this.getErrorRate('DB_ERROR'),
      },
      performanceScore: this.calculatePerformanceScore(),
    };

    return report;
  }

  private getErrorRate(errorType: ErrorEvent['type']) {
    const totalErrors = this.errors.filter(e => e.type === errorType).length;
    const totalOperations = this.metrics.filter(m => {
      switch (errorType) {
        case 'API_ERROR':
          return m.type === 'API_CALL';
        case 'RENDER_ERROR':
          return m.type === 'RENDER';
        case 'DB_ERROR':
          return m.type === 'DB_OPERATION';
        default:
          return false;
      }
    }).length;

    return totalOperations ? (totalErrors / totalOperations) * 100 : 0;
  }

  private calculatePerformanceScore() {
    const weights = {
      render: 0.4,
      api: 0.3,
      db: 0.2,
      image: 0.1,
    };

    const scores = {
      render: this.calculateTypeScore('RENDER', this.performanceThresholds.render),
      api: this.calculateTypeScore('API_CALL', this.performanceThresholds.apiCall),
      db: this.calculateTypeScore('DB_OPERATION', this.performanceThresholds.dbOperation),
      image: this.calculateTypeScore('IMAGE_LOAD', this.performanceThresholds.imageLoad),
    };

    return (
      scores.render * weights.render +
      scores.api * weights.api +
      scores.db * weights.db +
      scores.image * weights.image
    );
  }

  private calculateTypeScore(type: PerformanceMetric['type'], threshold: number) {
    const metrics = this.metrics.filter(m => m.type === type);
    if (!metrics.length) return 100;

    const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
    return Math.max(0, 100 - (avgDuration / threshold) * 100);
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
        duration,
        metadata: {
          timestamp: Date.now()
        }
      });
    }
  };
} 