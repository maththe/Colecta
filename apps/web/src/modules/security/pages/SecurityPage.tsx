import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  Camera,
  Clock,
  Eye,
  MapPin,
  MonitorPlay,
  Search,
  ShieldCheck,
  Trash2,
  Video,
  WifiOff,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { getSecurityLocations } from '../data/security.mock';
import {
  CAMERA_STATUS_LABELS,
  type CameraStatus,
  type SecurityCamera,
  type SecurityLocation,
} from '../types';
import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FilterChips } from '@/components/ui/filter-chips';
import { Input } from '@/components/ui/input';

type StatusFilter = CameraStatus | 'all';
type TargetFilter = SecurityCamera['target']['kind'] | 'all';

const STATUS_DOT: Record<CameraStatus, string> = {
  online: 'bg-primary',
  offline: 'bg-destructive',
  maintenance: 'bg-amber-500',
};

const STATUS_BADGE: Record<CameraStatus, 'success' | 'destructive' | 'warning'> = {
  online: 'success',
  offline: 'destructive',
  maintenance: 'warning',
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'maintenance', label: 'Manutenção' },
];

const TARGET_FILTERS: { value: TargetFilter; label: string }[] = [
  { value: 'all', label: 'Todos vínculos' },
  { value: 'location', label: 'Posições' },
  { value: 'trash_bin', label: 'Lixeiras' },
];

function statusSummary(cameras: SecurityCamera[]) {
  return {
    online: cameras.filter((camera) => camera.status === 'online').length,
    offline: cameras.filter((camera) => camera.status === 'offline').length,
    maintenance: cameras.filter((camera) => camera.status === 'maintenance').length,
  };
}

function latestSeen(cameras: SecurityCamera[]): string | null {
  return (
    cameras
      .map((camera) => camera.lastSeenAt)
      .filter((value): value is string => !!value)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null
  );
}

function locationWeight(location: SecurityLocation): number {
  const summary = statusSummary(location.cameras);
  return summary.offline * 3 + summary.maintenance * 2;
}

function targetText(camera: SecurityCamera): string {
  if (camera.target.kind === 'trash_bin') {
    return `${camera.target.code} ${camera.target.name}`;
  }
  return camera.target.name;
}

function cameraMatches(camera: SecurityCamera, query: string, status: StatusFilter, target: TargetFilter) {
  const q = query.trim().toLowerCase();
  const matchesQuery =
    !q ||
    camera.name.toLowerCase().includes(q) ||
    camera.code.toLowerCase().includes(q) ||
    camera.locationName.toLowerCase().includes(q) ||
    targetText(camera).toLowerCase().includes(q);
  const matchesStatus = status === 'all' || camera.status === status;
  const matchesTarget = target === 'all' || camera.target.kind === target;

  return matchesQuery && matchesStatus && matchesTarget;
}

function CameraStatusBadge({ status }: { status: CameraStatus }) {
  return <Badge variant={STATUS_BADGE[status]}>{CAMERA_STATUS_LABELS[status]}</Badge>;
}

function CameraImageFrame({
  camera,
  className,
  compact = false,
}: {
  camera: SecurityCamera;
  className?: string;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={cn(
        'relative aspect-video overflow-hidden rounded-lg border border-border bg-muted',
        className,
      )}
    >
      {!failed && (
        <img
          src={camera.imageUrl}
          alt={`Imagem da câmera ${camera.name}`}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(22,163,74,0.22),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.84))] px-4 text-center text-white">
          <MonitorPlay className={cn('mb-3 opacity-80', compact ? 'h-7 w-7' : 'h-10 w-10')} />
          <p className="max-w-full truncate text-sm font-semibold">{camera.name}</p>
          <p className="mt-1 font-mono text-xs text-white/70">{camera.code}</p>
        </div>
      )}
      <div className="absolute left-2 top-2 rounded bg-black/60 px-2 py-1 font-mono text-[11px] text-white">
        {camera.code}
      </div>
      <div className="absolute right-2 top-2 flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-[11px] font-medium text-white">
        <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[camera.status])} />
        {CAMERA_STATUS_LABELS[camera.status]}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  Icon,
}: {
  label: string;
  value: ReactNode;
  Icon: LucideIcon;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2 text-xs">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="font-medium text-foreground">{label}</div>
        <div className="truncate text-muted-foreground">{value}</div>
      </div>
    </div>
  );
}

function TargetLabel({ camera }: { camera: SecurityCamera }) {
  if (camera.target.kind === 'trash_bin') {
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <Trash2 className="h-3.5 w-3.5 shrink-0" />
        <span className="font-mono">{camera.target.code}</span>
        <span className="truncate">{camera.target.name}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <MapPin className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{camera.target.name}</span>
    </span>
  );
}

function SummaryTile({
  label,
  value,
  Icon,
  tone = 'default',
}: {
  label: string;
  value: number;
  Icon: LucideIcon;
  tone?: 'default' | 'danger';
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        </div>
        <Icon className={cn('h-5 w-5', tone === 'danger' ? 'text-destructive' : 'text-primary')} />
      </CardContent>
    </Card>
  );
}

function LocationList({
  locations,
  selectedId,
  onSelect,
}: {
  locations: SecurityLocation[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {locations.map((location) => {
        const summary = statusSummary(location.cameras);
        const active = location.id === selectedId;
        const lastSeen = latestSeen(location.cameras);

        return (
          <button
            key={location.id}
            type="button"
            onClick={() => onSelect(location.id)}
            className={cn(
              'flex w-full flex-col gap-2 rounded-lg border px-3 py-3 text-left transition-colors',
              active
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:bg-muted/60',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{location.name}</div>
                <div className="text-xs text-muted-foreground">
                  {location.cameras.length}{' '}
                  {location.cameras.length === 1 ? 'câmera' : 'câmeras'}
                </div>
              </div>
              {(summary.offline > 0 || summary.maintenance > 0) && (
                <Badge variant={summary.offline > 0 ? 'destructive' : 'warning'}>
                  {summary.offline > 0 ? `${summary.offline} offline` : `${summary.maintenance} manutenção`}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5">
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
      })}
    </div>
  );
}

function CameraCard({
  camera,
  onPreview,
}: {
  camera: SecurityCamera;
  onPreview: (camera: SecurityCamera) => void;
}) {
  return (
    <Card className="h-full">
      <div className="px-4">
        <CameraImageFrame camera={camera} compact />
      </div>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate">{camera.name}</CardTitle>
            <CardDescription className="truncate">{camera.model}</CardDescription>
          </div>
          <CameraStatusBadge status={camera.status} />
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <InfoRow label="Vinculada a" value={<TargetLabel camera={camera} />} Icon={MapPin} />
        <InfoRow label="Endereço IP" value={camera.ipAddress} Icon={Activity} />
        <InfoRow label="Qualidade" value={`${camera.resolution} · ${camera.fps} fps`} Icon={Video} />
        <InfoRow
          label="Último sinal"
          value={camera.lastSeenAt ? formatRelativeTime(camera.lastSeenAt) : 'Sem leitura'}
          Icon={Clock}
        />
      </CardContent>
      {camera.notes && (
        <CardContent className="pt-0">
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            {camera.notes}
          </p>
        </CardContent>
      )}
      <CardFooter className="justify-end">
        <Button type="button" onClick={() => onPreview(camera)}>
          <Eye className="h-4 w-4" />
          Visualizar
        </Button>
      </CardFooter>
    </Card>
  );
}

function CameraPreviewDialog({
  camera,
  onClose,
}: {
  camera: SecurityCamera | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!camera} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-slate-950 text-white ring-white/10 sm:max-w-6xl">
        {camera && (
          <>
            <DialogHeader>
              <DialogTitle className="text-white">{camera.name}</DialogTitle>
              <DialogDescription className="text-slate-300">
                {camera.code} · {camera.model} · {CAMERA_STATUS_LABELS[camera.status]}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <CameraImageFrame camera={camera} className="border-white/10" />
              <aside className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase text-slate-400">Status</span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium">
                    <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[camera.status])} />
                    {CAMERA_STATUS_LABELS[camera.status]}
                  </span>
                </div>
                <div className="rounded-lg bg-black/25 p-3 text-xs">
                  <div className="text-slate-400">Vinculada a</div>
                  <div className="mt-1 font-medium text-white">{targetText(camera)}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-black/25 p-3">
                    <div className="text-slate-400">IP</div>
                    <div className="mt-1 font-mono text-white">{camera.ipAddress}</div>
                  </div>
                  <div className="rounded-lg bg-black/25 p-3">
                    <div className="text-slate-400">FPS</div>
                    <div className="mt-1 text-white">{camera.fps}</div>
                  </div>
                  <div className="col-span-2 rounded-lg bg-black/25 p-3">
                    <div className="text-slate-400">Qualidade</div>
                    <div className="mt-1 text-white">{camera.resolution}</div>
                  </div>
                  <div className="col-span-2 rounded-lg bg-black/25 p-3">
                    <div className="text-slate-400">Último sinal</div>
                    <div className="mt-1 text-white">
                      {camera.lastSeenAt ? formatRelativeTime(camera.lastSeenAt) : 'Sem leitura'}
                    </div>
                  </div>
                </div>
                <Button type="button" variant="secondary" onClick={onClose} className="mt-auto">
                  Fechar visualização
                </Button>
              </aside>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function SecurityPage() {
  const navigate = useNavigate();
  const { locationId } = useParams<{ locationId?: string }>();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [targetFilter, setTargetFilter] = useState<TargetFilter>('all');
  const [preview, setPreview] = useState<SecurityCamera | null>(null);

  const allLocations = useMemo(() => getSecurityLocations(), []);
  const sortedLocations = useMemo(
    () =>
      [...allLocations].sort((a, b) => {
        const weight = locationWeight(b) - locationWeight(a);
        if (weight !== 0) return weight;
        return a.name.localeCompare(b.name, 'pt-BR');
      }),
    [allLocations],
  );

  const allCameras = sortedLocations.flatMap((location) => location.cameras);
  const summary = statusSummary(allCameras);
  const visibleLocationIds = new Set(
    sortedLocations
      .filter((location) =>
        location.cameras.some((camera) => cameraMatches(camera, query, statusFilter, targetFilter)),
      )
      .map((location) => location.id),
  );
  const filteredLocations = sortedLocations.filter((location) => visibleLocationIds.has(location.id));
  const fallbackLocation = sortedLocations.find((location) => location.id === locationId) ?? sortedLocations[0] ?? null;
  const selectedLocation =
    filteredLocations.find((location) => location.id === locationId) ??
    filteredLocations[0] ??
    fallbackLocation;
  const selectedCameras = selectedLocation?.cameras ?? [];
  const visibleCameras = selectedCameras.filter((camera) =>
    cameraMatches(camera, query, statusFilter, targetFilter),
  );
  const selectedSummary = statusSummary(selectedCameras);

  function selectLocation(id: string) {
    navigate(`/security/${id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Segurança</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitoramento de câmeras vinculadas a posições e lixeiras
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryTile label="Localizações" value={sortedLocations.length} Icon={MapPin} />
        <SummaryTile label="Câmeras" value={allCameras.length} Icon={Camera} />
        <SummaryTile label="Online" value={summary.online} Icon={ShieldCheck} />
        <SummaryTile
          label="Atenção"
          value={summary.offline + summary.maintenance}
          Icon={WifiOff}
          tone="danger"
        />
      </div>

      <section className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-card p-3 lg:sticky lg:top-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Localizações</h2>
              <Badge variant="outline">{filteredLocations.length}</Badge>
            </div>
            <div className="mb-3 lg:hidden">
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={filteredLocations.some((location) => location.id === selectedLocation?.id) ? selectedLocation?.id : ''}
                onChange={(event) => selectLocation(event.target.value)}
              >
                {filteredLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="hidden lg:block">
              <LocationList
                locations={filteredLocations}
                selectedId={selectedLocation?.id ?? ''}
                onSelect={selectLocation}
              />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por câmera, local, IP, lixeira"
                  className="pl-8"
                />
              </div>
              <div className="flex flex-col gap-2 md:items-end">
                <FilterChips
                  options={STATUS_FILTERS}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
                <FilterChips
                  options={TARGET_FILTERS}
                  value={targetFilter}
                  onChange={setTargetFilter}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{selectedLocation?.name ?? 'Sem localização'}</h2>
              <p className="text-sm text-muted-foreground">
                {visibleCameras.length}{' '}
                {visibleCameras.length === 1 ? 'câmera exibida' : 'câmeras exibidas'}
              </p>
            </div>
            {selectedLocation && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">{selectedSummary.online} online</Badge>
                {selectedSummary.maintenance > 0 && (
                  <Badge variant="warning">
                    {selectedSummary.maintenance} manutenção
                  </Badge>
                )}
                {selectedSummary.offline > 0 && (
                  <Badge variant="destructive">
                    {selectedSummary.offline} offline
                  </Badge>
                )}
              </div>
            )}
          </div>

          {visibleCameras.length === 0 ? (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-card py-12 text-sm text-muted-foreground">
              Nenhuma câmera atende aos filtros selecionados.
            </div>
          ) : (
            <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {visibleCameras.map((camera) => (
                <CameraCard key={camera.id} camera={camera} onPreview={setPreview} />
              ))}
            </section>
          )}
        </div>
      </section>

      <CameraPreviewDialog camera={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
