import { useCallback, useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import type { Feature, Polygon } from 'geojson';
import { Check, Crosshair, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CreateSiteInput, Site } from '../types';
import { boundaryGeometry, firstPolygon, polygonToLatLngs } from '../lib/site-geo';

interface Props {
  site: Site;
  /** Persiste a alteração (PATCH /sites/:id) e atualiza o Site no estado pai. */
  onSave: (data: Partial<CreateSiteInput>) => Promise<void>;
}

// Editor do contorno do recinto (somente ADMIN). Liga o leaflet-geoman para
// desenhar/editar o Polygon do boundary e salva via PATCH. Também permite fixar
// a visão inicial (center/zoom) do Site com o botão "usar visão atual".
//
// É renderizado como filho do MapContainer (precisa do `useMap`); o painel de
// ações é sobreposto ao mapa e não propaga cliques para o Leaflet.
export function SiteBoundaryEditor({ site, onSave }: Props) {
  const map = useMap();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Camada do polígono em edição (desenhado ou carregado do boundary salvo).
  const boundaryLayerRef = useRef<L.Polygon | null>(null);

  // Remove a camada de edição do mapa (ao cancelar/sair ou antes de redesenhar).
  const clearWorkingLayer = useCallback(() => {
    if (boundaryLayerRef.current) {
      boundaryLayerRef.current.remove();
      boundaryLayerRef.current = null;
    }
  }, []);

  // Liga/desliga o modo de edição: controles do geoman + camada editável do
  // contorno atual. A limpeza (cleanup) garante que nada vaze entre toggles.
  useEffect(() => {
    if (!editing) return;

    map.pm.addControls({
      position: 'topright',
      drawPolygon: true,
      editMode: true,
      dragMode: true,
      removalMode: true,
      // Só contorno (Polygon): escondemos as demais ferramentas.
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawCircle: false,
      drawText: false,
      cutPolygon: false,
      rotateMode: false,
    });

    // Carrega o contorno salvo como camada editável (se houver).
    const existing = firstPolygon(boundaryGeometry(site.boundary));
    if (existing) {
      const layer = L.polygon(polygonToLatLngs(existing));
      layer.addTo(map);
      boundaryLayerRef.current = layer;
    }

    // Um novo polígono desenhado substitui o anterior — só há um contorno.
    const handleCreate = (e: { layer: L.Layer }) => {
      if (boundaryLayerRef.current && boundaryLayerRef.current !== e.layer) {
        boundaryLayerRef.current.remove();
      }
      boundaryLayerRef.current = e.layer as L.Polygon;
    };
    map.on('pm:create', handleCreate);

    return () => {
      map.off('pm:create', handleCreate);
      map.pm.removeControls();
      map.pm.disableGlobalEditMode();
      map.pm.disableGlobalDragMode();
      map.pm.disableGlobalRemovalMode();
      map.pm.disableDraw();
    };
  }, [editing, map, site.boundary]);

  function startEditing() {
    setError(null);
    setEditing(true);
  }

  function cancelEditing() {
    if (busy) return;
    clearWorkingLayer();
    setError(null);
    setEditing(false);
  }

  async function persist(data: Partial<CreateSiteInput>) {
    setBusy(true);
    setError(null);
    try {
      await onSave(data);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar o recinto');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveBoundary() {
    const layer = boundaryLayerRef.current;
    // Sem polígono (ex.: o dono removeu o contorno) salva boundary nulo: o mapa
    // volta a "sem recorte/sem limites".
    const boundary = layer
      ? (layer.toGeoJSON() as Feature<Polygon>).geometry
      : null;
    const ok = await persist({ boundary });
    if (ok) {
      clearWorkingLayer();
      setEditing(false);
    }
  }

  // Fixa center/zoom do Site na visão atual do mapa (não sai do modo de edição).
  async function saveCurrentView() {
    const center = map.getCenter();
    await persist({
      centerLat: center.lat,
      centerLng: center.lng,
      defaultZoom: map.getZoom(),
    });
  }

  // Impede que cliques/scroll no painel cheguem ao mapa (pan/zoom indesejados).
  const panelRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      L.DomEvent.disableClickPropagation(node);
      L.DomEvent.disableScrollPropagation(node);
    }
  }, []);

  return (
    <div
      ref={panelRef}
      className="leaflet-bottom leaflet-left"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="leaflet-control m-3 flex flex-col gap-2 rounded-lg border border-border bg-card/95 p-2 shadow-lg backdrop-blur">
        {!editing ? (
          <Button type="button" size="sm" variant="outline" onClick={startEditing}>
            <Pencil className="h-3.5 w-3.5" />
            Editar recinto
          </Button>
        ) : (
          <>
            <p className="px-1 text-xs text-muted-foreground">
              Desenhe ou ajuste o contorno do recinto.
            </p>
            {error && <p className="px-1 text-xs text-destructive">{error}</p>}
            <Button type="button" size="sm" disabled={busy} onClick={saveBoundary}>
              <Check className="h-3.5 w-3.5" />
              {busy ? 'Salvando...' : 'Salvar contorno'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={saveCurrentView}
            >
              <Crosshair className="h-3.5 w-3.5" />
              Usar visão atual
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={cancelEditing}
            >
              <X className="h-3.5 w-3.5" />
              Cancelar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
