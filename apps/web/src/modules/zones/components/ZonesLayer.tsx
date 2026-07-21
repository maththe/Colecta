import { Polygon, Popup } from 'react-leaflet';
import type { Zone } from '../types';
import { zoneColor, zoneToPositions } from '../lib/zone-geo';

interface Props {
  zones: Zone[];
  /**
   * Quando false, os polígonos não capturam cliques (sem popup) — usado na tela
   * de "Adicionar no mapa", onde o clique deve chegar ao mapa para posicionar um
   * recurso, em vez de abrir o card da zona.
   */
  interactive?: boolean;
}

// Polígonos translúcidos das zonas, exibidos abaixo dos marcadores (o Leaflet
// coloca polígonos no overlayPane, abaixo do markerPane — independe da ordem).
export function ZonesLayer({ zones, interactive = true }: Props) {
  return (
    <>
      {zones.map((zone, index) => {
        const positions = zoneToPositions(zone.polygon);
        if (positions.length === 0) return null;
        const color = zoneColor(zone.color, index);
        return (
          <Polygon
            // `interactive` é opção de criação no Leaflet (setStyle não liga/
            // desliga o handler), então a key inclui a flag para remontar o
            // polígono quando o modo de seleção entra/sai.
            key={`${zone.id}:${interactive}`}
            positions={positions}
            interactive={interactive}
            pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.2, interactive }}
          >
            {interactive && (
              <Popup>
                <p style={{ fontWeight: 700, margin: '0 0 4px' }}>{zone.name}</p>
                {zone.category && (
                  <p style={{ fontSize: 12, margin: '2px 0' }}>{zone.category}</p>
                )}
                {/* Só a listagem traz a contagem — no get por id ela não vem. */}
                {zone.openTaskCount != null && (
                  <p style={{ fontSize: 12, margin: '2px 0' }}>
                    {zone.openTaskCount === 0
                      ? 'Nenhuma tarefa aberta'
                      : `${zone.openTaskCount} ${
                          zone.openTaskCount === 1 ? 'tarefa aberta' : 'tarefas abertas'
                        }`}
                  </p>
                )}
              </Popup>
            )}
          </Polygon>
        );
      })}
    </>
  );
}
