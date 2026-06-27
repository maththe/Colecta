import { useCallback, useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import type { Feature, Polygon } from 'geojson';
import { Check, Layers, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Site } from '@/modules/sites/types';
import {
  boundaryGeometry,
  firstPolygon,
  polygonToLatLngs,
} from '@/modules/sites/lib/site-geo';
import type { Zone } from '../types';
import { DEFAULT_ZONE_COLORS, zoneColor } from '../lib/zone-geo';

interface Props {
  site: Site;
  zones: Zone[];
  /** Recarrega o mapa após criar/editar/excluir uma zona (zoneId recalcula). */
  onChanged: () => void;
}

type Mode = 'list' | 'creating' | 'editing';

interface ZoneForm {
  name: string;
  category: string;
  color: string;
}

// Editor de zonas (somente ADMIN), renderizado como filho do MapContainer.
// Reusa o leaflet-geoman da Fase 1 para desenhar/editar o Polygon de cada zona;
// salva via /zones e dispara o recálculo de zoneId no back. Sem toolbar do
// geoman: usamos enableDraw/pm.enable programaticamente com nossos botões.
export function ZoneEditor({ site, zones, onChanged }: Props) {
  const map = useMap();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hasLayer, setHasLayer] = useState(false);
  const [form, setForm] = useState<ZoneForm>({ name: '', category: '', color: DEFAULT_ZONE_COLORS[0] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Polígono em edição/desenho (geoman).
  const workingLayerRef = useRef<L.Polygon | null>(null);

  const clearWorking = useCallback(() => {
    if (workingLayerRef.current) {
      workingLayerRef.current.remove();
      workingLayerRef.current = null;
    }
    setHasLayer(false);
  }, []);

  // Modo "criar": liga o desenho de Polygon do geoman e captura o resultado.
  useEffect(() => {
    if (mode !== 'creating') return;
    map.pm.enableDraw('Polygon');
    const onCreate = (e: { layer: L.Layer }) => {
      if (workingLayerRef.current) workingLayerRef.current.remove();
      workingLayerRef.current = e.layer as L.Polygon;
      map.pm.disableDraw();
      setHasLayer(true);
    };
    map.on('pm:create', onCreate);
    return () => {
      map.off('pm:create', onCreate);
      map.pm.disableDraw();
    };
  }, [mode, map]);

  function startCreate() {
    clearWorking();
    setEditingId(null);
    setError(null);
    setForm({ name: '', category: '', color: DEFAULT_ZONE_COLORS[zones.length % DEFAULT_ZONE_COLORS.length] });
    setMode('creating');
  }

  function startEdit(zone: Zone) {
    clearWorking();
    setError(null);
    const geometry = firstPolygon(boundaryGeometry(zone.polygon));
    if (geometry) {
      const layer = L.polygon(polygonToLatLngs(geometry));
      layer.addTo(map);
      layer.pm.enable({ allowSelfIntersection: false });
      workingLayerRef.current = layer;
      setHasLayer(true);
    }
    setEditingId(zone.id);
    setForm({ name: zone.name, category: zone.category ?? '', color: zone.color ?? DEFAULT_ZONE_COLORS[0] });
    setMode('editing');
  }

  function cancel() {
    if (busy) return;
    clearWorking();
    map.pm.disableDraw();
    setEditingId(null);
    setError(null);
    setMode('list');
  }

  async function save() {
    const layer = workingLayerRef.current;
    if (!form.name.trim()) {
      setError('Dê um nome à zona.');
      return;
    }
    if (!layer) {
      setError('Desenhe o polígono da zona.');
      return;
    }
    const polygon = (layer.toGeoJSON() as Feature<Polygon>).geometry;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'editing' && editingId) {
        await api.zones.update(editingId, {
          name: form.name.trim(),
          category: form.category.trim() || null,
          color: form.color || null,
          polygon,
        });
      } else {
        await api.zones.create({
          siteId: site.id,
          name: form.name.trim(),
          category: form.category.trim() || null,
          color: form.color || null,
          polygon,
        });
      }
      clearWorking();
      setEditingId(null);
      setMode('list');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar a zona.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(zone: Zone) {
    if (busy) return;
    if (!window.confirm(`Excluir a zona "${zone.name}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.zones.remove(zone.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir a zona.');
    } finally {
      setBusy(false);
    }
  }

  // Impede que cliques/scroll no painel cheguem ao mapa.
  const panelRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      L.DomEvent.disableClickPropagation(node);
      L.DomEvent.disableScrollPropagation(node);
    }
  }, []);

  const editing = mode === 'creating' || mode === 'editing';

  return (
    <div ref={panelRef} className="leaflet-bottom leaflet-right" style={{ pointerEvents: 'auto' }}>
      <div className="leaflet-control m-3 w-60 rounded-lg border border-border bg-card/95 p-2 shadow-lg backdrop-blur">
        {!open ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Layers className="h-3.5 w-3.5" />
            Gerenciar zonas
          </Button>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Zonas</span>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => {
                  cancel();
                  setOpen(false);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            {editing ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                  {mode === 'creating' && !hasLayer
                    ? 'Desenhe o polígono da zona no mapa.'
                    : 'Ajuste o polígono e os dados da zona.'}
                </p>
                <Input
                  placeholder="Nome da zona"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
                <Input
                  placeholder="Categoria (opcional)"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Cor
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="h-7 w-10 cursor-pointer rounded border border-input bg-transparent"
                  />
                </label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" disabled={busy || !hasLayer} onClick={save}>
                    <Check className="h-3.5 w-3.5" />
                    {busy ? 'Salvando...' : 'Salvar'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={cancel}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {zones.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma zona ainda.</p>
                ) : (
                  <ul className="flex max-h-48 flex-col gap-1 overflow-auto">
                    {zones.map((zone, index) => (
                      <li key={zone.id} className="flex items-center gap-2 text-sm">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ background: zoneColor(zone.color, index) }}
                        />
                        <span className="flex-1 truncate">{zone.name}</span>
                        <Button type="button" size="icon-sm" variant="ghost" onClick={() => startEdit(zone)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" size="icon-sm" variant="ghost" onClick={() => remove(zone)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <Button type="button" size="sm" onClick={startCreate}>
                  <Plus className="h-3.5 w-3.5" />
                  Nova zona
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
