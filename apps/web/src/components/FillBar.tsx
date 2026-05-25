import { cn } from '@/lib/utils';

interface FillBarProps {
  value: number | null;
}

export function FillBar({ value }: FillBarProps) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }

  const safe = Math.max(0, Math.min(100, value));
  const color =
    safe >= 90
      ? 'bg-destructive'
      : safe >= 70
        ? 'bg-amber-500'
        : 'bg-primary';

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-border">
        <div
          className={cn('h-full transition-all', color)}
          style={{ width: `${safe}%` }}
        />
      </div>
      <span className="min-w-8 text-xs text-muted-foreground">{safe}%</span>
    </div>
  );
}
