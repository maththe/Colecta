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

export interface UseAsyncDataOptions {
  /**
   * Quando definido, refaz a busca nesse intervalo (ms) — o mecanismo único de
   * polling do app (sem `setInterval` solto por tela). Pausa automaticamente
   * quando a aba está oculta e refaz a busca ao voltar a ficar visível.
   */
  refetchIntervalMs?: number;
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
  options?: UseAsyncDataOptions,
): UseAsyncDataResult<T> {
  const refetchIntervalMs = options?.refetchIntervalMs;
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

  // Polling opcional: só roda com a aba visível (não consome rede/servidor em
  // segundo plano) e refaz a busca ao voltar à aba. Limpa tudo no unmount.
  useEffect(() => {
    if (!refetchIntervalMs) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer === null) {
        timer = setInterval(() => {
          void reload();
        }, refetchIntervalMs);
      }
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void reload();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refetchIntervalMs, reload]);

  return {
    data,
    setData,
    error,
    loading: data === null && error === null,
    refreshing,
    reload,
  };
}
