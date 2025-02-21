export interface ErrorContext {
  section: string;
  action: string;
  message: string;
  context?: {
    [key: string]: string | number | boolean | null | undefined;
  };
}

export interface ErrorHandlerOptions {
  source: string;
  message: string;
  severity?: 'error' | 'warning' | 'info';
  metadata?: Record<string, unknown>;
} 