import { useCallback, useMemo, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store/store';
import { 
  loadSources, 
  createSource, 
  updateSource, 
  deleteSource 
} from '../store/sourcesThunks';
import { 
  selectAllSources, 
  selectSourceById, 
  selectSourcesState,
  selectSourcePerformance,
  selectConsignmentPayments,
  selectTotalConsignmentPayments
} from '../store/selectors';
import type { Source, SourceInput, SourceUpdate } from '../types/source';
import type { SourcePerformance, ConsignmentPayment } from '../store/selectors';

interface UseSourcesOptions {
  autoLoad?: boolean;
}

export const useSourcesOptimized = (options: UseSourcesOptions = {}) => {
  const { autoLoad = true } = options;
  const dispatch = useDispatch<AppDispatch>();
  const loadedRef = useRef(false);

  // Sélecteurs de base
  const sources = useSelector(selectAllSources);
  const sourcesState = useSelector(selectSourcesState);
  const isLoading = sourcesState.loading;
  const error = sourcesState.error;

  // Auto-chargement des sources - seulement une fois
  useEffect(() => {
    if (autoLoad && !loadedRef.current && !isLoading && !error) {
      loadedRef.current = true;
      dispatch(loadSources())
        .unwrap()
        .then(sources => {
          // Sources loaded successfully
        })
        .catch(error => {
          console.error('[useSourcesOptimized] Error loading sources:', error);
          loadedRef.current = false; // Reset on error so we can retry
        });
    }
  }, [autoLoad, isLoading, error, dispatch]);

  // Actions mémoïsées
  const actions = useMemo(() => ({
    load: () => dispatch(loadSources()),
    create: (sourceData: SourceInput) => dispatch(createSource(sourceData)),
    update: (id: number, updates: SourceUpdate) => dispatch(updateSource({ id, updates })),
    delete: (id: number) => dispatch(deleteSource(id)),
  }), [dispatch]);

  return {
    sources: sources || [],
    isLoading,
    error,
    actions,
  };
};

export const useSourceOptimized = (sourceId: number) => {
  const source = useSelector((state: RootState) => selectSourceById(state, sourceId));
  
  return {
    source,
  };
};

export const useSourcePerformance = () => {
  const performance = useSelector(selectSourcePerformance);
  const isLoading = useSelector((state: RootState) => 
    state.items.status === 'loading' || state.sources.loading
  );

  return {
    performance,
    isLoading,
  };
};

export const useConsignmentPayments = () => {
  const payments = useSelector(selectConsignmentPayments);
  const totalPayments = useSelector(selectTotalConsignmentPayments);
  const isLoading = useSelector((state: RootState) => 
    state.items.status === 'loading'
  );

  // Grouper par déposant
  const paymentsByConsignor = useMemo(() => {
    const grouped = new Map<string, ConsignmentPayment[]>();
    
    (payments || []).forEach(payment => {
      const existing = grouped.get(payment.consignorName) || [];
      grouped.set(payment.consignorName, [...existing, payment]);
    });

    return Array.from(grouped.entries()).map(([consignorName, payments]) => ({
      consignorName,
      payments,
      totalAmount: payments.reduce((sum, p) => sum + p.paymentAmount, 0),
      itemCount: payments.length,
    })).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [payments]);

  return {
    payments: payments || [],
    totalPayments: totalPayments || 0,
    paymentsByConsignor,
    isLoading,
  };
};

// Hook pour utiliser dans les formulaires
export const useSourceSelector = () => {
  const { sources, isLoading } = useSourcesOptimized();
  
  const sourceOptions = useMemo(() => 
    (sources || []).map(source => ({
      value: source.id,
      label: `${source.name} (${source.type})${source.city ? ` - ${source.city}` : ''}`,
      source,
    }))
  , [sources]);

  return {
    sourceOptions,
    isLoading,
  };
};