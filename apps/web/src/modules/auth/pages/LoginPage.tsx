import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Lock, Mail, Recycle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/modules/auth/context/AuthContext';
import { ApiError } from '@/lib/api';

interface FormValues {
  email: string;
  senha: string;
}

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [guestLoading, setGuestLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { email: '', senha: '' },
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (user) {
    const redirectTo = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/dashboard';
    return <Navigate to={redirectTo} replace />;
  }

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    setSubmitting(true);
    try {
      await login(values.email.trim(), values.senha);
      const redirectTo = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/dashboard';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente novamente.';
      setServerError(message);
    } finally {
      setSubmitting(false);
    }
  });

  const enterAsGuest = async () => {
    setServerError(null);
    setGuestLoading(true);
    try {
      await login('admin@colecta.com', 'admin123');
      const redirectTo = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/dashboard';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Demo indisponível no momento. Tente novamente.';
      setServerError(message);
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Recycle className="h-6 w-6" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">Colecta</h1>
            <p className="mt-1 text-sm text-muted-foreground">Entre para gerenciar suas lixeiras</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                  className="pl-8"
                  aria-invalid={!!errors.email}
                  {...register('email', {
                    required: 'Informe o e-mail',
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'E-mail inválido',
                    },
                  })}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="senha">Senha</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="senha"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-8"
                  aria-invalid={!!errors.senha}
                  {...register('senha', {
                    required: 'Informe a senha',
                    minLength: { value: 6, message: 'Mínimo de 6 caracteres' },
                  })}
                />
              </div>
              {errors.senha && (
                <p className="text-xs text-destructive">{errors.senha.message}</p>
              )}
            </div>

            {serverError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {serverError}
              </div>
            )}

            <Button type="submit" size="lg" disabled={submitting} className="mt-2 w-full">
              {submitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={guestLoading || submitting}
            onClick={enterAsGuest}
          >
            {guestLoading ? 'Entrando...' : 'Entrar como visitante (demo)'}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Acesso completo com dados de exemplo, sem cadastro.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Colecta © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
