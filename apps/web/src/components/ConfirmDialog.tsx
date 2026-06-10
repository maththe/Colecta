import type { ReactNode } from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Texto exibido no botão de confirmação enquanto loading=true. */
  loadingLabel?: string;
  /** Usa o estilo destrutivo (vermelho) no botão de confirmação. */
  destructive?: boolean;
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

// Diálogo de confirmação reutilizável, construído sobre o AlertDialog do Base UI:
// diferente de um Dialog comum, ele não fecha ao clicar fora ou apertar Esc,
// exigindo uma escolha explícita — apropriado para ações destrutivas.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  loadingLabel = 'Excluindo...',
  destructive = false,
  loading = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o && !loading) onCancel();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop
          className={cn(
            'fixed inset-0 isolate z-[1000] bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs',
            'data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
          )}
        />
        <AlertDialog.Popup
          className={cn(
            'fixed top-1/2 left-1/2 z-[1001] grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4',
            'rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm',
            'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          )}
        >
          <div className="flex flex-col gap-2">
            <AlertDialog.Title className="text-base leading-none font-medium">
              {title}
            </AlertDialog.Title>
            {description && (
              <AlertDialog.Description className="text-sm text-muted-foreground">
                {description}
              </AlertDialog.Description>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onCancel} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? 'destructive' : 'default'}
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? loadingLabel : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
