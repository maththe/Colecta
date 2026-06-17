import type { SecurityCamera } from '../types';
import { CameraCard } from './CameraCard';

export function CameraGrid({
  cameras,
  showLocation = false,
  onPreview,
  onReport,
}: {
  cameras: SecurityCamera[];
  /** Exibe o nome da localização em cada card (visões "Todas"/"Atenção"). */
  showLocation?: boolean;
  onPreview: (camera: SecurityCamera) => void;
  onReport: (camera: SecurityCamera) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cameras.map((camera) => (
        <CameraCard
          key={camera.id}
          camera={camera}
          showLocation={showLocation}
          onPreview={onPreview}
          onReport={onReport}
        />
      ))}
    </div>
  );
}
