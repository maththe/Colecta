import { useForm } from 'react-hook-form';
import type { CreateLocationInput, Location } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  initial?: Location | null;
  defaults?: Partial<CreateLocationInput>;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (values: CreateLocationInput) => void | Promise<void>;
}

type FormValues = {
  name: string;
  description?: string;
  latitude: string;
  longitude: string;
  floorsCount: string;
};

function numberToInput(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

export function LocationForm({ initial, defaults, submitting, onCancel, onSubmit }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: initial?.name ?? defaults?.name ?? '',
      description: initial?.description ?? defaults?.description ?? '',
      latitude: initial ? String(initial.latitude) : numberToInput(defaults?.latitude),
      longitude: initial ? String(initial.longitude) : numberToInput(defaults?.longitude),
      floorsCount:
        initial?.floorsCount != null
          ? String(initial.floorsCount)
          : numberToInput(defaults?.floorsCount ?? undefined),
    },
  });

  const submit = handleSubmit((values) =>
    onSubmit({
      name: values.name.trim(),
      description: values.description?.trim() || undefined,
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
      floorsCount: values.floorsCount.trim() !== '' ? Number(values.floorsCount) : null,
    }),
  );

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="location-name">Nome</Label>
        <Input
          id="location-name"
          {...register('name', { required: 'Informe o nome' })}
          aria-invalid={!!errors.name}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="location-description">Descrição</Label>
        <Textarea id="location-description" rows={3} {...register('description')} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location-lat">Latitude</Label>
          <Input
            id="location-lat"
            type="number"
            step="any"
            {...register('latitude', {
              required: 'Informe a latitude',
              validate: (value) => {
                const number = Number(value);
                if (Number.isNaN(number)) return 'Latitude inválida';
                if (number < -90 || number > 90) return 'Entre -90 e 90';
                return true;
              },
            })}
            aria-invalid={!!errors.latitude}
          />
          {errors.latitude && (
            <p className="text-xs text-destructive">{errors.latitude.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location-lng">Longitude</Label>
          <Input
            id="location-lng"
            type="number"
            step="any"
            {...register('longitude', {
              required: 'Informe a longitude',
              validate: (value) => {
                const number = Number(value);
                if (Number.isNaN(number)) return 'Longitude inválida';
                if (number < -180 || number > 180) return 'Entre -180 e 180';
                return true;
              },
            })}
            aria-invalid={!!errors.longitude}
          />
          {errors.longitude && (
            <p className="text-xs text-destructive">{errors.longitude.message}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location-floors">Número de andares</Label>
          <Input
            id="location-floors"
            type="number"
            min={1}
            placeholder="ex: 5"
            {...register('floorsCount', {
              validate: (value) => {
                if (value === undefined || value.trim() === '') return true;
                const n = Number(value);
                if (!Number.isInteger(n) || n < 1) return 'Informe um número de andares válido';
                return true;
              },
            })}
            aria-invalid={!!errors.floorsCount}
          />
          {errors.floorsCount && (
            <p className="text-xs text-destructive">{errors.floorsCount.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Você poderá enviar a planta de cada andar e posicionar as lixeiras no mapa da construção.
          </p>
        </div>
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
