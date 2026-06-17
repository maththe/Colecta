import { AlertTriangle, Clock, MapPin, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import type { SecurityCamera } from '../types';
import { STATUS_ACCENT } from '../lib/camera-status';
import { CameraStatusBadge } from './CameraStatusBadge';
import { CameraImageFrame, TargetLabel } from './CameraImageFrame';

export function CameraCard({
  camera,
  showLocation = false,
  onPreview,
  onReport,
}: {
  camera: SecurityCamera;
  /** Exibe o nome da localização (usado nas visões agregadas "Todas"/"Atenção"). */
  showLocation?: boolean;
  onPreview: (camera: SecurityCamera) => void;
  onReport: (camera: SecurityCamera) => void;
}) {
  const TargetIcon = camera.target.kind === 'trash_bin' ? Trash2 : MapPin;

  return (
    <article
      className={cn(
        'flex flex-col rounded-xl border border-l-4 border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
        STATUS_ACCENT[camera.status],
      )}
    >
      <button
        type="button"
        onClick={() => onPreview(camera)}
        className="flex flex-col gap-3 rounded-xl p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Visualizar câmera ${camera.name}`}
      >
        <CameraImageFrame camera={camera} compact />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{camera.name}</h3>
            {showLocation && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{camera.locationName}</span>
              </p>
            )}
          </div>
          <CameraStatusBadge status={camera.status} />
        </div>

        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            <TargetIcon className="h-3.5 w-3.5 shrink-0" />
            <TargetLabel camera={camera} />
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {camera.lastSeenAt ? `Último sinal ${formatRelativeTime(camera.lastSeenAt)}` : 'Sem leitura recente'}
          </span>
        </div>
      </button>

      <div className="flex justify-end border-t border-border px-3 py-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onReport(camera)}>
          <AlertTriangle className="h-4 w-4" />
          Relatar ocorrência
        </Button>
      </div>
    </article>
  );
}
