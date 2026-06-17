import { useState } from 'react';
import { MonitorPlay } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CAMERA_STATUS_LABELS, type SecurityCamera } from '../types';
import { STATUS_DOT } from '../lib/camera-status';

export function CameraImageFrame({
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

/** Vínculo da câmera (lixeira ou posição) renderizado de forma compacta. */
export function TargetLabel({ camera }: { camera: SecurityCamera }) {
  if (camera.target.kind === 'trash_bin') {
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span className="font-mono">{camera.target.code}</span>
        <span className="truncate">{camera.target.name}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="truncate">{camera.target.name}</span>
    </span>
  );
}
