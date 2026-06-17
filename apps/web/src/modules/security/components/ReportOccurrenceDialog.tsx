import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import {
  TASK_PRIORITY_LABELS,
  type CreateSecurityOccurrenceInput,
  type TaskPriority,
} from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { SecurityCamera } from '../types';
import { defaultOccurrenceTitle, targetText, type OccurrenceLink } from '../lib/occurrence-link';

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

export function ReportOccurrenceDialog({
  camera,
  link,
  referenceError,
  submitting,
  error,
  onClose,
  onSubmit,
}: {
  camera: SecurityCamera | null;
  link: OccurrenceLink | null;
  referenceError: string | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: CreateSecurityOccurrenceInput) => void | Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('high');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (!camera) return;
    setTitle(defaultOccurrenceTitle(camera));
    setDescription('');
    setPriority('high');
    setDueDate('');
  }, [camera]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!camera || !title.trim()) return;
    void onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      trashBinId: link?.trashBinId ?? null,
      locationId: link?.locationId ?? null,
      cameraId: camera.id,
      cameraCode: camera.code,
      cameraName: camera.name,
      locationName: camera.locationName,
      targetLabel: targetText(camera),
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
    });
  }

  return (
    <Dialog open={!!camera} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {camera && (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Relatar ocorrência</DialogTitle>
              <DialogDescription>
                A tarefa será criada para a equipe de Segurança.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {referenceError && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
                {referenceError}
              </div>
            )}

            <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 text-xs sm:grid-cols-2">
              <div>
                <div className="font-medium text-foreground">Câmera</div>
                <div className="mt-1 text-muted-foreground">
                  <span className="font-mono">{camera.code}</span> - {camera.name}
                </div>
              </div>
              <div>
                <div className="font-medium text-foreground">Local</div>
                <div className="mt-1 text-muted-foreground">{camera.locationName}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="font-medium text-foreground">Vínculo da tarefa</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
                  <span>{link?.label ?? camera.locationName}</span>
                  {link?.matched ? (
                    <Badge variant="success">
                      <CheckCircle2 className="h-3 w-3" />
                      Vinculado
                    </Badge>
                  ) : (
                    <Badge variant="outline">Somente descrição</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="occurrence-title">Título</Label>
              <Input
                id="occurrence-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={180}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="occurrence-priority">Prioridade</Label>
                <select
                  id="occurrence-priority"
                  className={selectClass}
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as TaskPriority)}
                >
                  {(['medium', 'high', 'urgent'] satisfies TaskPriority[]).map((value) => (
                    <option key={value} value={value}>
                      {TASK_PRIORITY_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="occurrence-due">Prazo</Label>
                <Input
                  id="occurrence-due"
                  type="datetime-local"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="occurrence-description">Descrição</Label>
              <Textarea
                id="occurrence-description"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Descreva o que foi observado na câmera"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting || !title.trim()}>
                <Send className="h-4 w-4" />
                {submitting ? 'Criando...' : 'Criar tarefa'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
