import { LayoutGrid, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { CAMERA_STATUS_LABELS, type SecurityLocation } from '../types';
import { STATUS_DOT } from '../lib/camera-status';
import { latestSeen, statusSummary } from '../lib/camera-filters';

export const ALL_VIEW = 'all';
export const ATTENTION_VIEW = 'attention';

interface Props {
  locations: SecurityLocation[];
  selectedKey: string;
  totalCameras: number;
  totalAttention: number;
  onSelect: (key: string) => void;
}

function VirtualEntry({
  active,
  label,
  count,
  Icon,
  tone = 'default',
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  Icon: LucideIcon;
  tone?: 'default' | 'danger';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors',
        active ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-muted/60',
      )}
    >
      <Icon
        className={cn('h-4 w-4 shrink-0', tone === 'danger' ? 'text-destructive' : 'text-primary')}
      />
      <span className="flex-1 truncate">{label}</span>
      <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
        {count}
      </span>
    </button>
  );
}

function LocationButton({
  location,
  active,
  onSelect,
}: {
  location: SecurityLocation;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const summary = statusSummary(location.cameras);
  const lastSeen = latestSeen(location.cameras);

  return (
    <button
      type="button"
      onClick={() => onSelect(location.id)}
      className={cn(
        'flex w-full flex-col gap-2 rounded-lg border px-3 py-3 text-left transition-colors',
        active ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-muted/60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{location.name}</div>
          <div className="text-xs text-muted-foreground">
            {location.cameras.length} {location.cameras.length === 1 ? 'câmera' : 'câmeras'}
          </div>
        </div>
        {(summary.offline > 0 || summary.maintenance > 0) && (
          <Badge variant={summary.offline > 0 ? 'destructive' : 'warning'}>
            {summary.offline > 0 ? `${summary.offline} offline` : `${summary.maintenance} manutenção`}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {location.cameras.map((camera) => (
          <span
            key={camera.id}
            className={cn('h-2 w-2 rounded-full', STATUS_DOT[camera.status])}
            title={`${camera.name}: ${CAMERA_STATUS_LABELS[camera.status]}`}
          />
        ))}
      </div>
      <div className="text-xs text-muted-foreground">
        {lastSeen ? formatRelativeTime(lastSeen) : 'Sem sinal recente'}
      </div>
    </button>
  );
}

export function LocationSidebar({
  locations,
  selectedKey,
  totalCameras,
  totalAttention,
  onSelect,
}: Props) {
  return (
    <aside className="flex flex-col gap-3">
      <div className="rounded-xl border border-border bg-card p-3 lg:sticky lg:top-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Localizações</h2>
          <Badge variant="outline">{locations.length}</Badge>
        </div>

        {/* Mobile: dropdown único com visões virtuais + localizações. */}
        <div className="mb-3 lg:hidden">
          <select
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={selectedKey}
            onChange={(event) => onSelect(event.target.value)}
          >
            <option value={ATTENTION_VIEW}>Atenção ({totalAttention})</option>
            <option value={ALL_VIEW}>Todas as câmeras ({totalCameras})</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>

        <div className="hidden flex-col gap-2 lg:flex">
          <VirtualEntry
            active={selectedKey === ATTENTION_VIEW}
            label="Atenção"
            count={totalAttention}
            Icon={AlertTriangle}
            tone="danger"
            onClick={() => onSelect(ATTENTION_VIEW)}
          />
          <VirtualEntry
            active={selectedKey === ALL_VIEW}
            label="Todas as câmeras"
            count={totalCameras}
            Icon={LayoutGrid}
            onClick={() => onSelect(ALL_VIEW)}
          />
          <div className="my-1 h-px bg-border" />
          {locations.map((location) => (
            <LocationButton
              key={location.id}
              location={location}
              active={location.id === selectedKey}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
