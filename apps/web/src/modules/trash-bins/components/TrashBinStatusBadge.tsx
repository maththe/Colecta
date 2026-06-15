import { Badge } from '@/components/ui/badge';
import { TRASH_BIN_STATUS_LABELS, type TrashBinStatus } from '@/types';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';

const BIN_VARIANT: Record<TrashBinStatus, BadgeVariant> = {
  active: 'success',
  inactive: 'secondary',
  full: 'destructive',
  maintenance: 'warning',
  offline: 'secondary',
};

export function TrashBinStatusBadge({ status }: { status: TrashBinStatus }) {
  return (
    <Badge variant={BIN_VARIANT[status]}>
      {TRASH_BIN_STATUS_LABELS[status]}
    </Badge>
  );
}
