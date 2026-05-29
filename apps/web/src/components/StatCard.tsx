import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StatCardTone = 'primary' | 'destructive' | 'warning' | 'info';

const TONE_CLASS: Record<StatCardTone, string> = {
  primary: 'bg-primary/10 text-primary',
  destructive: 'bg-destructive/10 text-destructive',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  info: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
};

// Compact KPI tile with a tinted icon chip, matching the dashboard style.
export function StatCard({
  label,
  value,
  hint,
  Icon,
  tone,
}: {
  label: string;
  value: number | string;
  hint?: string;
  Icon: LucideIcon;
  tone: StatCardTone;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardDescription>{label}</CardDescription>
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', TONE_CLASS[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
