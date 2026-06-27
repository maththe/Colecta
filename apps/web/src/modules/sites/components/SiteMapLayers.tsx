import { useEffect, useMemo } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapBaseLayer } from '@/modules/trash-bins/components/MapBaseLayer';
import { ZonesLayer } from '@/modules/zones/components/ZonesLayer';
import type { Zone } from '@/modules/zones/types';
import type { Site } from '../types';
import { buildSiteMask } from '../lib/site-geo';

// Aplica os limites de pan (maxBounds) do recinto de forma reativa: o MapContainer
// só lê maxBounds na criação, então fazemos via efeito para refletir o contorno
// recém-desenhado. Sem bounds (recinto sem contorno), libera o pan livre.
function MapBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.setMaxBounds(bounds);
      map.options.maxBoundsViscosity = 0.7;
    } else {
      // latLngBounds inválido limpa os limites no Leaflet.
      map.setMaxBounds(undefined as unknown as L.LatLngBounds);
    }
  }, [map, bounds]);
  return null;
}

interface Props {
  site: Site;
  zones?: Zone[];
  /** Quando true (padrão), desenha os polígonos das zonas. */
  showZones?: boolean;
  /**
   * Quando false, as zonas não capturam cliques (sem popup) — para telas onde o
   * clique no mapa precisa posicionar um recurso (ex.: "Adicionar no mapa").
   */
  zonesInteractive?: boolean;
}

// Camadas do recinto compartilhadas por todos os mapas (mapa principal e
// "Adicionar no mapa"): base (Protomaps/MapTiler/OSM), máscara recortando o
// recinto, limites de pan e as zonas. Renderizado como filho do MapContainer.
export function SiteMapLayers({
  site,
  zones = [],
  showZones = true,
  zonesInteractive = true,
}: Props) {
  const siteMask = useMemo(() => buildSiteMask(site.boundary), [site.boundary]);

  return (
    <>
      <MapBaseLayer key={site.baseMode} baseMode={site.baseMode} />
      {/* Máscara semi-opaca recortando o recinto. A `key` muda quando o Site é
          salvo (updatedAt), forçando o GeoJSON a refletir o novo contorno. */}
      {siteMask && (
        <GeoJSON
          key={`mask-${site.updatedAt}`}
          data={siteMask.maskFeature}
          interactive={false}
          style={{ color: '#1f2937', weight: 1, fillColor: '#0f172a', fillOpacity: 0.35 }}
        />
      )}
      <MapBounds bounds={siteMask?.maxBounds ?? null} />
      {showZones && <ZonesLayer zones={zones} interactive={zonesInteractive} />}
    </>
  );
}
