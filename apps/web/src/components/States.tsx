import { cn } from '@/lib/utils';

export function LoadingState({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-card py-12 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-12 text-sm text-destructive">
      Erro: {message}
    </div>
  );
}

export function EmptyState({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center rounded-xl border border-dashed border-border bg-card py-12 text-sm text-muted-foreground", className)}>
      {label}
    </div>
  );
}
