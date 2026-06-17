import { useForm } from 'react-hook-form';
import type { CreateCameraInput } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  defaults?: Partial<CreateCameraInput>;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (values: CreateCameraInput) => void | Promise<void>;
}

type FormValues = {
  name: string;
  code: string;
  latitude: string;
  longitude: string;
};

function numberToInput(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

export function CameraForm({ defaults, submitting, onCancel, onSubmit }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: defaults?.name ?? '',
      code: defaults?.code ?? '',
      latitude: numberToInput(defaults?.latitude),
      longitude: numberToInput(defaults?.longitude),
    },
  });

  const submit = handleSubmit((values) =>
    onSubmit({
      name: values.name.trim(),
      code: values.code.trim(),
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
    }),
  );

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="camera-name">Nome</Label>
        <Input
          id="camera-name"
          {...register('name', { required: 'Informe o nome' })}
          aria-invalid={!!errors.name}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="camera-code">Código</Label>
        <Input
          id="camera-code"
          placeholder="ex: CAM-001"
          {...register('code', { required: 'Informe o código' })}
          aria-invalid={!!errors.code}
        />
        {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="camera-lat">Latitude</Label>
          <Input
            id="camera-lat"
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
          <Label htmlFor="camera-lng">Longitude</Label>
          <Input
            id="camera-lng"
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

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : 'Cadastrar'}
        </Button>
      </div>
    </form>
  );
}
