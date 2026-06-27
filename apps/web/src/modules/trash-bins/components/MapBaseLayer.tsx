import { useEffect } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import { leafletLayer } from 'protomaps-leaflet';
import type { SiteBaseMode } from '@/modules/sites/types';

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Self-host Protomaps (.pmtiles) e MapTiler vêm por env — nada hardcoded. Em dev,
// sem essas variáveis, a base cai no OSM padrão (decidido no plano).
const PMTILES_URL = import.meta.env.VITE_PMTILES_URL;
const PMTILES_FLAVOR = import.meta.env.VITE_PMTILES_FLAVOR ?? 'light';
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

// Camada Protomaps adicionada imperativamente: protomaps-leaflet não expõe um
// componente react-leaflet, então criamos a layer e a anexamos ao mapa.
function ProtomapsLayer({ url, flavor }: { url: string; flavor: string }) {
  const map = useMap();
  useEffect(() => {
    const layer = leafletLayer({
      url,
      flavor,
      attribution:
        '&copy; <a href="https://protomaps.com">Protomaps</a> | ' + OSM_ATTRIBUTION,
    });
    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, url, flavor]);
  return null;
}

// Resolve a camada base conforme o baseMode do Site. A atribuição do provedor
// (+ OSM) acompanha sempre a camada renderizada.
export function MapBaseLayer({ baseMode }: { baseMode: SiteBaseMode }) {
  // Base suave self-host. Sem .pmtiles configurado (dev), cai no OSM padrão.
  if (baseMode === 'osm_muted' && PMTILES_URL) {
    return <ProtomapsLayer url={PMTILES_URL} flavor={PMTILES_FLAVOR} />;
  }

  // Satélite via MapTiler (chave por env). Sem chave, cai no OSM.
  if (baseMode === 'satellite' && MAPTILER_KEY) {
    return (
      <TileLayer
        url={`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`}
        attribution={
          '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> | ' +
          OSM_ATTRIBUTION
        }
        tileSize={512}
        zoomOffset={-1}
      />
    );
  }

  // Fallback: dev (sem pmtiles/chave) e placeholder do modo overlay (Fase 4).
  return <TileLayer url={OSM_URL} attribution={OSM_ATTRIBUTION} />;
}
