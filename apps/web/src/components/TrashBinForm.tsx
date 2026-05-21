import { useForm } from 'react-hook-form';
import type { CreateTrashBinInput, TrashBin } from '../types';

interface Props {
  initial?: TrashBin | null;
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

export function TrashBinForm({ initial, submitting, onCancel, onSubmit }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: initial?.name ?? '',
      code: initial?.code ?? '',
      locationDescription: initial?.locationDescription ?? '',
      latitude: initial ? String(initial.latitude) : '',
      longitude: initial ? String(initial.longitude) : '',
      capacityLiters: initial ? String(initial.capacityLiters) : '100',
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
    <form className="form" onSubmit={submit} noValidate>
      <div className="form__field">
        <label className="form__label" htmlFor="bin-name">
          Nome
        </label>
        <input
          id="bin-name"
          className="form__input"
          {...register('name', { required: 'Informe o nome' })}
        />
        {errors.name && <span className="form__error">{errors.name.message}</span>}
      </div>

      <div className="form__field">
        <label className="form__label" htmlFor="bin-code">
          Código
        </label>
        <input
          id="bin-code"
          className="form__input"
          placeholder="ex: PRQ-001"
          {...register('code', { required: 'Informe o código' })}
        />
        {errors.code && <span className="form__error">{errors.code.message}</span>}
      </div>

      <div className="form__field">
        <label className="form__label" htmlFor="bin-loc">
          Descrição / localização
        </label>
        <input
          id="bin-loc"
          className="form__input"
          placeholder="Próxima ao quiosque"
          {...register('locationDescription')}
        />
      </div>

      <div className="form__row">
        <div className="form__field">
          <label className="form__label" htmlFor="bin-lat">
            Latitude
          </label>
          <input
            id="bin-lat"
            type="number"
            step="any"
            className="form__input"
            {...register('latitude', {
              required: 'Informe a latitude',
              validate: (v) => {
                const n = Number(v);
                if (Number.isNaN(n)) return 'Latitude inválida';
                if (n < -90 || n > 90) return 'Entre -90 e 90';
                return true;
              },
            })}
          />
          {errors.latitude && (
            <span className="form__error">{errors.latitude.message}</span>
          )}
        </div>
        <div className="form__field">
          <label className="form__label" htmlFor="bin-lng">
            Longitude
          </label>
          <input
            id="bin-lng"
            type="number"
            step="any"
            className="form__input"
            {...register('longitude', {
              required: 'Informe a longitude',
              validate: (v) => {
                const n = Number(v);
                if (Number.isNaN(n)) return 'Longitude inválida';
                if (n < -180 || n > 180) return 'Entre -180 e 180';
                return true;
              },
            })}
          />
          {errors.longitude && (
            <span className="form__error">{errors.longitude.message}</span>
          )}
        </div>
      </div>

      <div className="form__field">
        <label className="form__label" htmlFor="bin-cap">
          Capacidade (litros)
        </label>
        <input
          id="bin-cap"
          type="number"
          min={1}
          className="form__input"
          {...register('capacityLiters', {
            required: 'Informe a capacidade',
            validate: (v) => {
              const n = Number(v);
              if (!Number.isFinite(n) || n <= 0) return 'Capacidade inválida';
              return true;
            },
          })}
        />
        {errors.capacityLiters && (
          <span className="form__error">{errors.capacityLiters.message}</span>
        )}
      </div>

      <div className="form__actions">
        <button type="button" className="btn btn--secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Salvando...' : initial ? 'Salvar alterações' : 'Cadastrar'}
        </button>
      </div>
    </form>
  );
}
