import { useEffect, useRef } from 'react';
import { monitoring } from '../services/monitoring';

export function useMonitoring(componentName: string) {
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    startTimeRef.current = performance.now();

    return () => {
      const duration = performance.now() - startTimeRef.current;
      monitoring.trackRender(componentName, duration, true);
    };
  }, [componentName]);

  const trackApiCall = async <T>(
    name: string,
    apiCall: () => Promise<T>
  ): Promise<T> => {
    const startTime = performance.now();
    try {
      const result = await apiCall();
      const duration = performance.now() - startTime;
      monitoring.trackApiCall(name, duration, true);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      monitoring.trackApiCall(name, duration, false);
      throw error;
    }
  };

  const trackDbOperation = async <T>(
    operation: string,
    dbCall: () => Promise<T>
  ): Promise<T> => {
    const startTime = performance.now();
    try {
      const result = await dbCall();
      const duration = performance.now() - startTime;
      monitoring.trackDbOperation(operation, duration, true);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      monitoring.trackDbOperation(operation, duration, false);
      throw error;
    }
  };

  return {
    trackApiCall,
    trackDbOperation,
  };
} 