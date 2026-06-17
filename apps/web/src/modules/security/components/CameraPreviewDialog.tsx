import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CAMERA_STATUS_LABELS, type SecurityCamera } from '../types';
import { STATUS_DOT } from '../lib/camera-status';
import { targetText } from '../lib/occurrence-link';
import { CameraImageFrame } from './CameraImageFrame';

function InfoBox({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-black/25 p-3">
      <div className="text-slate-400">{label}</div>
      <div className={cn('mt-1 text-white', mono && 'font-mono')}>{value}</div>
    </div>
  );
}

export function CameraPreviewDialog({
  camera,
  onClose,
  onReport,
}: {
  camera: SecurityCamera | null;
  onClose: () => void;
  /** Opcional: quando omitido (ex.: no mapa), o botão de ocorrência some. */
  onReport?: (camera: SecurityCamera) => void;
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
                  <InfoBox label="IP" value={camera.ipAddress} mono />
                  <InfoBox label="FPS" value={String(camera.fps)} />
                  <div className="col-span-2">
                    <InfoBox label="Qualidade" value={camera.resolution} />
                  </div>
                  <div className="col-span-2">
                    <InfoBox
                      label="Último sinal"
                      value={camera.lastSeenAt ? formatRelativeTime(camera.lastSeenAt) : 'Sem leitura'}
                    />
                  </div>
                </div>
                {onReport && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onReport(camera)}
                    className="mt-auto"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Relatar ocorrência
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  className={cn(!onReport && 'mt-auto')}
                >
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
