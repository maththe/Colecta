import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { ErrorState, LoadingState, EmptyState } from '../components/States';
import type { TrashBin } from '../types';
import { TrashBinMap } from '../components/TrashBinMap';

export function MapPage() {
  const [bins, setBins] = useState<TrashBin[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.trashBins
      .list()
      .then((data) => {
        if (!cancelled) setBins(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Falha ao carregar mapa');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const center = useMemo<[number, number]>(() => {
    if (!bins || bins.length === 0) return [-23.5874, -46.6576];
    const sum = bins.reduce(
      (acc, b) => ({ lat: acc.lat + b.latitude, lng: acc.lng + b.longitude }),
      { lat: 0, lng: 0 },
    );
    return [sum.lat / bins.length, sum.lng / bins.length];
  }, [bins]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Mapa</h1>
        <p className="mt-1 text-sm text-muted-foreground">Localização das lixeiras em tempo real</p>
      </div>

      {error && <ErrorState message={error} />}
      {!bins && !error && <LoadingState label="Carregando mapa..." />}
      {bins && bins.length === 0 && (
        <EmptyState label="Sem lixeiras cadastradas para exibir no mapa." />
      )}
      {bins && bins.length > 0 && (
        <div className="min-h-[480px] overflow-hidden rounded-xl border border-border" style={{ height: 'calc(100vh - 200px)' }}>
          <TrashBinMap bins={bins} center={center} />
        </div>
      )}
    </div>
  );
}
