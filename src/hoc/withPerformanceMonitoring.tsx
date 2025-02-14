import React, { useEffect, useRef } from 'react';
import { monitoring } from '../services/monitoring';

export function withPerformanceMonitoring<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string = WrappedComponent.displayName || WrappedComponent.name
) {
  return function WithPerformanceMonitoringComponent(props: P) {
    const renderStartTime = useRef<number>();
    
    useEffect(() => {
      return () => {
        if (renderStartTime.current) {
          const renderDuration = Date.now() - renderStartTime.current;
          monitoring.recordMetric({
            type: 'RENDER',
            name: componentName,
            duration: renderDuration,
            metadata: {
              props: Object.keys(props)
            }
          });
        }
      };
    });

    useEffect(() => {
      renderStartTime.current = Date.now();
    });

    try {
      return <WrappedComponent {...props} />;
    } catch (error) {
      monitoring.recordError({
        type: 'RENDER_ERROR',
        message: error instanceof Error ? error.message : 'Unknown render error',
        stack: error instanceof Error ? error.stack : undefined,
        metadata: {
          componentName,
          props: Object.keys(props)
        }
      });
      throw error;
    }
  };
}

// Décorateur pour les composants de classe
export function MonitorPerformance(componentName?: string) {
  return function <T extends { new (...args: any[]): React.Component }>(
    constructor: T
  ) {
    const WrappedComponent = constructor;
    const displayName = componentName || WrappedComponent.name;

    return class extends WrappedComponent {
      private renderStartTime: number = 0;

      componentDidMount() {
        if (super.componentDidMount) {
          super.componentDidMount();
        }
        const renderDuration = Date.now() - this.renderStartTime;
        monitoring.recordMetric({
          type: 'RENDER',
          name: displayName,
          duration: renderDuration,
          metadata: {
            props: Object.keys(this.props)
          }
        });
      }

      componentDidUpdate(prevProps: Readonly<any>, prevState: Readonly<any>, snapshot?: any) {
        if (super.componentDidUpdate) {
          super.componentDidUpdate(prevProps, prevState, snapshot);
        }
        const renderDuration = Date.now() - this.renderStartTime;
        monitoring.recordMetric({
          type: 'RENDER',
          name: displayName,
          duration: renderDuration,
          metadata: {
            props: Object.keys(this.props),
            prevProps: Object.keys(prevProps)
          }
        });
      }

      render() {
        this.renderStartTime = Date.now();
        try {
          return super.render();
        } catch (error) {
          monitoring.recordError({
            type: 'RENDER_ERROR',
            message: error instanceof Error ? error.message : 'Unknown render error',
            stack: error instanceof Error ? error.stack : undefined,
            metadata: {
              componentName: displayName,
              props: Object.keys(this.props)
            }
          });
          throw error;
        }
      }
    };
  };
} 