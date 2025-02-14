import * as Sentry from '@sentry/react-native';
import { Middleware, Action } from 'redux';

export const errorMiddleware: Middleware = store => next => action => {
  try {
    return next(action);
  } catch (error) {
    console.error('Error in Redux action:', error);
    const actionType = (action as Action).type || 'UNKNOWN_ACTION';
    Sentry.captureException(error, {
      extra: {
        action: actionType,
        state: store.getState(),
      },
      tags: {
        location: 'redux_middleware',
        actionType,
      },
    });
    throw error;
  }
}; 