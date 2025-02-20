import * as Sentry from '@sentry/react-native';
import { EXPO_PUBLIC_SENTRY_DSN } from '@env';

Sentry.init({
  dsn: EXPO_PUBLIC_SENTRY_DSN,
  enableAutoSessionTracking: true,
  sessionTrackingIntervalMillis: 30000,
  debug: __DEV__,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  enableNative: true,
  attachStacktrace: true,
  normalizeDepth: 10,
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'console' && !__DEV__) {
      return null;
    }
    return breadcrumb;
  },
}); 