interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // délai de base en ms
  maxDelay: number; // délai maximum en ms
  backoffStrategy: 'linear' | 'exponential' | 'fibonacci' | 'adaptive';
  jitter: boolean; // ajouter de la randomisation
  retryOn: (error: Error) => boolean; // fonction pour déterminer si on doit retry
  onRetry?: (attempt: number, error: Error, nextDelay: number) => void;
  circuit?: CircuitBreakerConfig;
}

interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number; // nombre d'échecs avant d'ouvrir le circuit
  recoveryTimeout: number; // temps avant de tester à nouveau
  successThreshold: number; // succès consécutifs pour fermer le circuit
}

interface TimeoutConfig {
  operation: number; // timeout pour l'opération
  connection: number; // timeout pour la connexion
  total: number; // timeout total incluant les retries
}

interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
  circuitBreakerTriggered: boolean;
}

interface NetworkConditions {
  latency: number;
  packetLoss: number;
  bandwidth: number;
  stability: number; // 0-1, 1 étant parfaitement stable
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffStrategy: 'exponential',
  jitter: true,
  retryOn: (error: Error) => {
    // Retry sur les erreurs réseau, mais pas sur les erreurs 4xx (sauf 429)
    if (error.name === 'NetworkError') return true;
    if (error.message.includes('timeout')) return true;
    if (error.message.includes('429')) return true; // Rate limit
    if (error.message.includes('503')) return true; // Service unavailable
    return false;
  }
};

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  enabled: true,
  failureThreshold: 5,
  recoveryTimeout: 30000,
  successThreshold: 3
};

const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  operation: 10000,
  connection: 5000,
  total: 60000
};

enum CircuitState {
  CLOSED = 'closed',    // Circuit fermé, requêtes passent
  OPEN = 'open',        // Circuit ouvert, requêtes échouent immédiatement
  HALF_OPEN = 'half_open' // Circuit en test, quelques requêtes passent
}

class RetryService {
  private static instance: RetryService | null = null;
  private circuits = new Map<string, {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailTime: number;
    config: CircuitBreakerConfig;
  }>();
  
  private networkConditions: NetworkConditions = {
    latency: 100,
    packetLoss: 0,
    bandwidth: 10,
    stability: 1.0
  };
  
  private retryStats = new Map<string, {
    attempts: number;
    successes: number;
    failures: number;
    avgRetryTime: number;
  }>();

  static getInstance(): RetryService {
    if (!RetryService.instance) {
      RetryService.instance = new RetryService();
    }
    return RetryService.instance;
  }

  /**
   * Exécuter une opération avec retry intelligent
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    timeouts: Partial<TimeoutConfig> = {},
    operationId?: string
  ): Promise<RetryResult<T>> {
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    const timeoutConfig = { ...DEFAULT_TIMEOUT_CONFIG, ...timeouts };
    
    const startTime = performance.now();
    let lastError: Error | null = null;
    let circuitBreakerTriggered = false;

    // Vérifier le circuit breaker
    if (operationId && retryConfig.circuit?.enabled) {
      const circuitState = this.getCircuitState(operationId, retryConfig.circuit);
      if (circuitState === CircuitState.OPEN) {
        circuitBreakerTriggered = true;
        return {
          success: false,
          error: new Error('Circuit breaker is open'),
          attempts: 0,
          totalTime: performance.now() - startTime,
          circuitBreakerTriggered: true
        };
      }
    }

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        // Vérifier le timeout total
        const elapsedTime = performance.now() - startTime;
        if (elapsedTime > timeoutConfig.total) {
          throw new Error(`Total timeout exceeded: ${timeoutConfig.total}ms`);
        }

        // Exécuter l'opération avec timeout
        const result = await this.executeWithTimeout(
          operation,
          timeoutConfig.operation,
          timeoutConfig.connection
        );

        // Succès - mettre à jour les stats
        this.recordSuccess(operationId, attempt);
        
        return {
          success: true,
          result,
          attempts: attempt + 1,
          totalTime: performance.now() - startTime,
          circuitBreakerTriggered: false
        };

      } catch (error) {
        lastError = error as Error;
        
        // Vérifier si on doit faire un retry
        const shouldRetry = attempt < retryConfig.maxRetries && 
                           retryConfig.retryOn(lastError);

        if (!shouldRetry) {
          this.recordFailure(operationId, attempt + 1);
          break;
        }

        // Calculer le délai avant le prochain retry
        const delay = this.calculateDelay(
          attempt,
          retryConfig.baseDelay,
          retryConfig.maxDelay,
          retryConfig.backoffStrategy,
          retryConfig.jitter
        );

        // Notifier du retry
        retryConfig.onRetry?.(attempt + 1, lastError, delay);

        console.log(`[RetryService] Retry ${attempt + 1}/${retryConfig.maxRetries} pour ${operationId || 'operation'} dans ${delay}ms. Erreur: ${lastError.message}`);

        // Attendre avant le prochain essai
        await this.delay(delay);
      }
    }

    // Tous les retries ont échoué
    this.recordFailure(operationId, retryConfig.maxRetries + 1);
    
    return {
      success: false,
      error: lastError || new Error('Unknown error'),
      attempts: retryConfig.maxRetries + 1,
      totalTime: performance.now() - startTime,
      circuitBreakerTriggered
    };
  }

  /**
   * Exécuter une opération avec timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    operationTimeout: number,
    connectionTimeout: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let operationComplete = false;
      let connectionTimer: NodeJS.Timeout | null = null;
      let operationTimer: NodeJS.Timeout | null = null;

      // Timer de connexion (plus court)
      connectionTimer = setTimeout(() => {
        if (!operationComplete) {
          operationComplete = true;
          reject(new Error(`Connection timeout after ${connectionTimeout}ms`));
        }
      }, connectionTimeout);

      // Timer d'opération (plus long)
      operationTimer = setTimeout(() => {
        if (!operationComplete) {
          operationComplete = true;
          reject(new Error(`Operation timeout after ${operationTimeout}ms`));
        }
      }, operationTimeout);

      // Exécuter l'opération
      operation()
        .then(result => {
          if (!operationComplete) {
            operationComplete = true;
            clearTimeout(connectionTimer!);
            clearTimeout(operationTimer!);
            resolve(result);
          }
        })
        .catch(error => {
          if (!operationComplete) {
            operationComplete = true;
            clearTimeout(connectionTimer!);
            clearTimeout(operationTimer!);
            reject(error);
          }
        });
    });
  }

  /**
   * Calculer le délai pour le prochain retry
   */
  private calculateDelay(
    attempt: number,
    baseDelay: number,
    maxDelay: number,
    strategy: 'linear' | 'exponential' | 'fibonacci' | 'adaptive',
    jitter: boolean
  ): number {
    let delay: number;

    switch (strategy) {
      case 'linear':
        delay = baseDelay * (attempt + 1);
        break;

      case 'exponential':
        delay = baseDelay * Math.pow(2, attempt);
        break;

      case 'fibonacci':
        delay = baseDelay * this.fibonacci(attempt + 1);
        break;

      case 'adaptive':
        delay = this.calculateAdaptiveDelay(attempt, baseDelay);
        break;

      default:
        delay = baseDelay;
    }

    // Appliquer la limite maximum
    delay = Math.min(delay, maxDelay);

    // Ajouter du jitter pour éviter la synchronisation des retries
    if (jitter) {
      const jitterAmount = delay * 0.1; // 10% de jitter
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }

    return Math.max(0, Math.round(delay));
  }

  /**
   * Calculer le délai adaptatif basé sur les conditions réseau
   */
  private calculateAdaptiveDelay(attempt: number, baseDelay: number): number {
    // Adapter selon les conditions réseau
    const latencyFactor = Math.max(0.5, this.networkConditions.latency / 100);
    const packetLossFactor = 1 + (this.networkConditions.packetLoss * 2);
    const stabilityFactor = 2 - this.networkConditions.stability;

    const adaptedBaseDelay = baseDelay * latencyFactor * packetLossFactor * stabilityFactor;
    
    // Appliquer une progression exponentielle modérée
    return adaptedBaseDelay * Math.pow(1.5, attempt);
  }

  /**
   * Calculer le nombre de Fibonacci
   */
  private fibonacci(n: number): number {
    if (n <= 2) return 1;
    let a = 1, b = 1;
    for (let i = 3; i <= n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  }

  /**
   * Attendre un délai
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtenir l'état du circuit breaker
   */
  private getCircuitState(operationId: string, config: CircuitBreakerConfig): CircuitState {
    let circuit = this.circuits.get(operationId);
    
    if (!circuit) {
      circuit = {
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 0,
        lastFailTime: 0,
        config
      };
      this.circuits.set(operationId, circuit);
    }

    const now = Date.now();

    // Si le circuit est ouvert, vérifier s'il faut passer en half-open
    if (circuit.state === CircuitState.OPEN) {
      if (now - circuit.lastFailTime > config.recoveryTimeout) {
        circuit.state = CircuitState.HALF_OPEN;
        circuit.successes = 0;
        console.log(`[RetryService] Circuit ${operationId} passé en HALF_OPEN`);
      }
    }

    return circuit.state;
  }

  /**
   * Enregistrer un succès
   */
  private recordSuccess(operationId?: string, attempts?: number): void {
    if (!operationId) return;

    // Mettre à jour les stats générales
    const stats = this.retryStats.get(operationId) || {
      attempts: 0,
      successes: 0,
      failures: 0,
      avgRetryTime: 0
    };
    
    stats.successes++;
    if (attempts !== undefined) {
      stats.attempts += attempts;
    }
    this.retryStats.set(operationId, stats);

    // Mettre à jour le circuit breaker
    const circuit = this.circuits.get(operationId);
    if (circuit) {
      circuit.successes++;
      circuit.failures = 0; // Reset les échecs sur un succès

      // Si on était en half-open et qu'on a assez de succès, fermer le circuit
      if (circuit.state === CircuitState.HALF_OPEN && 
          circuit.successes >= circuit.config.successThreshold) {
        circuit.state = CircuitState.CLOSED;
        console.log(`[RetryService] Circuit ${operationId} fermé après ${circuit.successes} succès`);
      }
    }
  }

  /**
   * Enregistrer un échec
   */
  private recordFailure(operationId?: string, attempts?: number): void {
    if (!operationId) return;

    // Mettre à jour les stats générales
    const stats = this.retryStats.get(operationId) || {
      attempts: 0,
      successes: 0,
      failures: 0,
      avgRetryTime: 0
    };
    
    stats.failures++;
    if (attempts !== undefined) {
      stats.attempts += attempts;
    }
    this.retryStats.set(operationId, stats);

    // Mettre à jour le circuit breaker
    const circuit = this.circuits.get(operationId);
    if (circuit) {
      circuit.failures++;
      circuit.successes = 0; // Reset les succès sur un échec
      circuit.lastFailTime = Date.now();

      // Vérifier s'il faut ouvrir le circuit
      if (circuit.failures >= circuit.config.failureThreshold) {
        circuit.state = CircuitState.OPEN;
        console.log(`[RetryService] Circuit ${operationId} ouvert après ${circuit.failures} échecs`);
      }
    }
  }

  /**
   * Mettre à jour les conditions réseau
   */
  updateNetworkConditions(conditions: Partial<NetworkConditions>): void {
    this.networkConditions = { ...this.networkConditions, ...conditions };
    console.log('[RetryService] Conditions réseau mises à jour:', this.networkConditions);
  }

  /**
   * Obtenir les statistiques de retry
   */
  getRetryStats(operationId?: string): typeof this.retryStats | { attempts: number; successes: number; failures: number; avgRetryTime: number } | undefined {
    if (operationId) {
      return this.retryStats.get(operationId);
    }
    return this.retryStats;
  }

  /**
   * Obtenir l'état des circuits breakers
   */
  getCircuitStates(): Map<string, { state: CircuitState; failures: number; successes: number; lastFailTime: number }> {
    return new Map(
      Array.from(this.circuits.entries()).map(([id, circuit]) => [
        id,
        {
          state: circuit.state,
          failures: circuit.failures,
          successes: circuit.successes,
          lastFailTime: circuit.lastFailTime
        }
      ])
    );
  }

  /**
   * Réinitialiser un circuit breaker
   */
  resetCircuit(operationId: string): void {
    const circuit = this.circuits.get(operationId);
    if (circuit) {
      circuit.state = CircuitState.CLOSED;
      circuit.failures = 0;
      circuit.successes = 0;
      circuit.lastFailTime = 0;
      console.log(`[RetryService] Circuit ${operationId} réinitialisé`);
    }
  }

  /**
   * Réinitialiser toutes les statistiques
   */
  resetStats(): void {
    this.retryStats.clear();
    this.circuits.clear();
    console.log('[RetryService] Toutes les statistiques réinitialisées');
  }

  /**
   * Évaluer automatiquement les conditions réseau
   */
  async assessNetworkConditions(): Promise<NetworkConditions> {
    const startTime = performance.now();
    const testUrl = '/ping'; // Endpoint de test
    let successfulRequests = 0;
    const numTests = 5;
    let totalLatency = 0;

    // Faire plusieurs requêtes de test
    for (let i = 0; i < numTests; i++) {
      try {
        const requestStart = performance.now();
        const response = await fetch(testUrl, { 
          method: 'HEAD',
          cache: 'no-cache'
        });
        const requestEnd = performance.now();

        if (response.ok) {
          successfulRequests++;
          totalLatency += (requestEnd - requestStart);
        }
      } catch {
        // Échec de requête compté dans le packet loss
      }
    }

    const avgLatency = successfulRequests > 0 ? totalLatency / successfulRequests : 1000;
    const packetLoss = (numTests - successfulRequests) / numTests;
    const stability = successfulRequests / numTests;

    // Estimer la bande passante (très approximatif)
    let bandwidth = 10; // Défaut
    if (navigator.connection) {
      bandwidth = navigator.connection.downlink || 10;
    }

    const conditions: NetworkConditions = {
      latency: avgLatency,
      packetLoss,
      bandwidth,
      stability
    };

    this.updateNetworkConditions(conditions);
    return conditions;
  }

  /**
   * Créer une configuration de retry optimisée pour les conditions actuelles
   */
  createOptimizedRetryConfig(operationId: string): RetryConfig {
    const baseConfig = { ...DEFAULT_RETRY_CONFIG };
    
    // Adapter selon les conditions réseau
    if (this.networkConditions.stability < 0.7) {
      // Réseau instable - plus de retries avec délais plus longs
      baseConfig.maxRetries = 5;
      baseConfig.baseDelay = 2000;
      baseConfig.backoffStrategy = 'adaptive';
    } else if (this.networkConditions.latency > 500) {
      // Latence élevée - délais plus longs
      baseConfig.baseDelay = 1500;
      baseConfig.maxDelay = 60000;
    } else if (this.networkConditions.packetLoss > 0.1) {
      // Perte de paquets - plus de retries
      baseConfig.maxRetries = 4;
      baseConfig.backoffStrategy = 'exponential';
    }

    // Adapter selon l'historique de l'opération
    const stats = this.retryStats.get(operationId);
    if (stats) {
      const failureRate = stats.failures / (stats.successes + stats.failures);
      if (failureRate > 0.3) {
        // Taux d'échec élevé - stratégie plus conservative
        baseConfig.maxRetries = Math.min(baseConfig.maxRetries + 2, 6);
        baseConfig.baseDelay *= 1.5;
      }
    }

    return baseConfig;
  }
}

export const retryService = RetryService.getInstance();
export { RetryConfig, TimeoutConfig, RetryResult, NetworkConditions, CircuitState };
export default RetryService;