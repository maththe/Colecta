import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiError } from '../lib/api';

export interface UseAsyncDataResult<T> {
  data: T | null;
  /** Permite atualização otimista do dado já carregado. */
  setData: Dispatch<SetStateAction<T | null>>;
  error: string | null;
  /** true apenas no primeiro carregamento, antes de existir dado ou erro. */
  loading: boolean;
  /** true durante qualquer busca, inclusive recargas manuais. */
  refreshing: boolean;
  reload: () => Promise<void>;
}

/**
 * Encapsula o ciclo de carregamento de dados padrão das páginas: busca no
 * mount, mensagem de erro amigável, indicador de refresh e recarga manual.
 *
 * O `fetcher` precisa ter referência estável (função de módulo ou
 * `useCallback`) — mudar a referência dispara um novo carregamento.
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  fallbackError = 'Falha ao carregar dados',
): UseAsyncDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      setData(await fetcher());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallbackError);
    } finally {
      setRefreshing(false);
    }
  }, [fetcher, fallbackError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    data,
    setData,
    error,
    loading: data === null && error === null,
    refreshing,
    reload,
  };
}
