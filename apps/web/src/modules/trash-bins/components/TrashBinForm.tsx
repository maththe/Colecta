import { useForm } from 'react-hook-form';
import type { CreateTrashBinInput, TrashBin } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  initial?: TrashBin | null;
  defaults?: Partial<CreateTrashBinInput>;
  submitting?: boolean;
  /**
   * Quando a lixeira pertence a uma construção: fixa a localização (prédio),
   * esconde os campos de lat/lng e mostra o seletor de andar. A posição interna
   * (posX/posY) é definida arrastando a lixeira no mapa da construção.
   */
  building?: { locationId: string; floors: string[]; defaultFloor?: string };
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
  floor: string;
};

function numberToInput(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

export function TrashBinForm({
  initial,
  defaults,
  submitting,
  building,
  onCancel,
  onSubmit,
}: Props) {
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
      floor: initial?.floor ?? defaults?.floor ?? building?.defaultFloor ?? '',
    },
  });

  const submit = handleSubmit((values) => {
    const payload: CreateTrashBinInput = {
      name: values.name.trim(),
      code: values.code.trim(),
      locationDescription: values.locationDescription?.trim() || undefined,
      capacityLiters: Number(values.capacityLiters),
    };

    if (building) {
      // Lixeira dentro do prédio: vincula à localização existente e ao andar.
      // Lat/lng são herdados da construção, então não os enviamos.
      payload.locationId = building.locationId;
      payload.floor = values.floor || null;
    } else {
      payload.latitude = Number(values.latitude);
      payload.longitude = Number(values.longitude);
    }

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

      {!building && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bin-loc">Descrição / localização</Label>
          <Input
            id="bin-loc"
            placeholder="Próxima ao quiosque"
            {...register('locationDescription')}
          />
        </div>
      )}

      {building ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bin-floor">Andar</Label>
          <select
            id="bin-floor"
            className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            {...register('floor')}
          >
            <option value="">Sem andar</option>
            {building.floors.map((floor) => (
              <option key={floor} value={floor}>
                {floor}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            A posição na planta é definida arrastando a lixeira no mapa da construção.
          </p>
        </div>
      ) : (
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
      )}

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
