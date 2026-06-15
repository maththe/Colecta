import { useForm } from 'react-hook-form';
import type { CreateTrashBinInput, TrashBin } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  initial?: TrashBin | null;
  defaults?: Partial<CreateTrashBinInput>;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (values: CreateTrashBinInput) => void | Promise<void>;
}

type FormValues = {
  name: string;
  code: string;
  locationDescription?: string;
  latitude: string;
  longitude: string;
  capacityLiters: string;
};

function numberToInput(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

export function TrashBinForm({ initial, defaults, submitting, onCancel, onSubmit }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: initial?.name ?? defaults?.name ?? '',
      code: initial?.code ?? defaults?.code ?? '',
      locationDescription: initial?.locationDescription ?? defaults?.locationDescription ?? '',
      latitude: initial ? String(initial.latitude) : numberToInput(defaults?.latitude),
      longitude: initial ? String(initial.longitude) : numberToInput(defaults?.longitude),
      capacityLiters: initial
        ? String(initial.capacityLiters)
        : String(defaults?.capacityLiters ?? 100),
    },
  });

  const submit = handleSubmit((values) => {
    const payload: CreateTrashBinInput = {
      name: values.name.trim(),
      code: values.code.trim(),
      locationDescription: values.locationDescription?.trim() || undefined,
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
      capacityLiters: Number(values.capacityLiters),
    };
    return onSubmit(payload);
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bin-name">Nome</Label>
        <Input
          id="bin-name"
          {...register('name', { required: 'Informe o nome' })}
          aria-invalid={!!errors.name}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bin-code">Código</Label>
        <Input
          id="bin-code"
          placeholder="ex: PRQ-001"
          {...register('code', { required: 'Informe o código' })}
          aria-invalid={!!errors.code}
        />
        {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bin-loc">Descrição / localização</Label>
        <Input
          id="bin-loc"
          placeholder="Próxima ao quiosque"
          {...register('locationDescription')}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bin-lat">Latitude</Label>
          <Input
            id="bin-lat"
            type="number"
            step="any"
            {...register('latitude', {
              required: 'Informe a latitude',
              validate: (v) => {
                const n = Number(v);
                if (Number.isNaN(n)) return 'Latitude inválida';
                if (n < -90 || n > 90) return 'Entre -90 e 90';
                return true;
              },
            })}
            aria-invalid={!!errors.latitude}
          />
          {errors.latitude && <p className="text-xs text-destructive">{errors.latitude.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bin-lng">Longitude</Label>
          <Input
            id="bin-lng"
            type="number"
            step="any"
            {...register('longitude', {
              required: 'Informe a longitude',
              validate: (v) => {
                const n = Number(v);
                if (Number.isNaN(n)) return 'Longitude inválida';
                if (n < -180 || n > 180) return 'Entre -180 e 180';
                return true;
              },
            })}
            aria-invalid={!!errors.longitude}
          />
          {errors.longitude && <p className="text-xs text-destructive">{errors.longitude.message}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bin-cap">Capacidade (litros)</Label>
        <Input
          id="bin-cap"
          type="number"
          min={1}
          {...register('capacityLiters', {
            required: 'Informe a capacidade',
            validate: (v) => {
              const n = Number(v);
              if (!Number.isFinite(n) || n <= 0) return 'Capacidade inválida';
              return true;
            },
          })}
          aria-invalid={!!errors.capacityLiters}
        />
        {errors.capacityLiters && (
          <p className="text-xs text-destructive">{errors.capacityLiters.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : initial ? 'Salvar alterações' : 'Cadastrar'}
        </Button>
      </div>
    </form>
  );
}
