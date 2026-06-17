import { Badge } from '@/components/ui/badge';
import { CAMERA_STATUS_LABELS, type CameraStatus } from '../types';
import { STATUS_BADGE } from '../lib/camera-status';

export function CameraStatusBadge({ status }: { status: CameraStatus }) {
  return <Badge variant={STATUS_BADGE[status]}>{CAMERA_STATUS_LABELS[status]}</Badge>;
}
