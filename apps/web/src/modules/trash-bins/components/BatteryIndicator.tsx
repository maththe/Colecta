import { Badge } from '@/components/ui/badge';

interface Props {
  value: number | null;
}

export function BatteryIndicator({ value }: Props) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  const variant =
    value <= 15 ? 'destructive' : value <= 30 ? 'outline' : 'secondary';
  return <Badge variant={variant}>{value}%</Badge>;
}
