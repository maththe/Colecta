import { useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import {
  TASK_PRIORITY_LABELS,
  type CreateSecurityOccurrenceInput,
  type Location,
  type TaskPriority,
  type TrashBin,
} from '@/types';
import type { SecurityCamera } from '@/modules/security/types';
import { cameraLocationLabel, groupCamerasByLocation } from '@/modules/security/lib/camera-filters';
import {
  defaultOccurrenceTitle,
  occurrenceLink,
  targetText,
} from '@/modules/security/lib/occurrence-link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  cameras: SecurityCamera[];
  bins: TrashBin[];
  locations: Location[];
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (values: CreateSecurityOccurrenceInput) => void | Promise<void>;
}

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

export function SecurityOccurrenceForm({
  cameras,
  bins,
  locations,
  submitting,
  onCancel,
  onSubmit,
}: Props) {
  const securityLocations = useMemo(() => groupCamerasByLocation(cameras), [cameras]);

  const [cameraId, setCameraId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('high');
  const [dueDate, setDueDate] = useState('');

  const selectedCamera = cameras.find((camera) => camera.id === cameraId) ?? null;
  const link = selectedCamera ? occurrenceLink(selectedCamera, locations, bins) : null;

  function handleCameraChange(camera: SecurityCamera | null) {
    setCameraId(camera?.id ?? '');
    setTitle(camera ? defaultOccurrenceTitle(camera) : '');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCamera || !title.trim()) return;
    void onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      trashBinId: link?.trashBinId ?? null,
      locationId: link?.locationId ?? null,
      cameraId: selectedCamera.id,
      cameraCode: selectedCamera.code,
      cameraName: selectedCamera.name,
      locationName: selectedCamera.locationName,
      targetLabel: targetText(selectedCamera),
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
    });
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <p className="text-sm text-muted-foreground">
        A tarefa será criada para a equipe de Segurança, com o vínculo da câmera.
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="occurrence-camera">Câmera</Label>
        <select
          id="occurrence-camera"
          className={selectClass}
          value={cameraId}
          onChange={(event) =>
            handleCameraChange(cameras.find((camera) => camera.id === event.target.value) ?? null)
          }
          required
        >
          <option value="">Selecione a câmera</option>
          {securityLocations.map((location) => (
            <optgroup key={location.id} label={location.name}>
              {location.cameras.map((camera) => (
                <option key={camera.id} value={camera.id}>
                  {camera.code} — {camera.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {selectedCamera && (
        <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 text-xs sm:grid-cols-2">
          <div>
            <div className="font-medium text-foreground">Câmera</div>
            <div className="mt-1 text-muted-foreground">
              <span className="font-mono">{selectedCamera.code}</span> - {selectedCamera.name}
            </div>
          </div>
          <div>
            <div className="font-medium text-foreground">Local</div>
            <div className="mt-1 text-muted-foreground">
              {cameraLocationLabel(selectedCamera)}
            </div>
          </div>
          <div className="sm:col-span-2">
            <div className="font-medium text-foreground">Vínculo da tarefa</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
              <span>{link?.label ?? selectedCamera.locationName}</span>
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
      )}

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

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting || !selectedCamera || !title.trim()}>
          <Send className="h-4 w-4" />
          {submitting ? 'Criando...' : 'Criar tarefa'}
        </Button>
      </div>
    </form>
  );
}
