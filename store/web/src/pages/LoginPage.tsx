import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { ApiError } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.js';
import { isValidEmail } from '../auth/validation.js';
import { useToast } from '../toast/ToastProvider.js';

interface FieldErrors {
  email?: string;
  password?: string;
}

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) {
    errors.email = 'Informe seu e-mail.';
  } else if (!isValidEmail(email)) {
    errors.email = 'Informe um e-mail válido.';
  }
  if (!password) {
    errors.password = 'Informe sua senha.';
  }
  return errors;
}

const inputClass =
  'mt-1 h-11 w-full rounded-lg border border-ink-700 bg-ink-800 px-4 text-sm text-fg placeholder:text-muted focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const errors = validate(email, password);
  const emailError = touched.email || submitted ? errors.email : undefined;
  const passwordError = touched.password || submitted ? errors.password : undefined;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    setFormError(null);

    if (Object.keys(validate(email, password)).length > 0) {
      return;
    }

    setBusy(true);
    try {
      const loggedIn = await login({ email, password });
      toast.show(`Bem-vindo(a), ${loggedIn.name}!`, { variant: 'success' });
      navigate('/');
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 401
            ? 'E-mail ou senha inválidos'
            : err.message
          : 'Não foi possível entrar. Tente novamente.';
      setFormError(message);
      toast.show(message, { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="w-full px-4 py-16 md:px-8">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="font-display text-2xl font-bold text-fg">Entrar</h1>
        <p className="mt-1 text-sm text-muted">
          Não tem uma conta?{' '}
          <Link to="/register" className="text-neon-cyan hover:underline">
            Criar conta
          </Link>
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
          {formError && (
            <p
              role="alert"
              className="rounded-lg border border-neon-pink bg-ink-900 px-4 py-3 text-sm text-fg"
            >
              {formError}
            </p>
          )}

          <div>
            <label htmlFor="email" className="block text-xs text-muted">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              aria-invalid={Boolean(emailError)}
              className={inputClass}
            />
            {emailError && <p className="mt-1 text-xs text-neon-pink">{emailError}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-xs text-muted">
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              aria-invalid={Boolean(passwordError)}
              className={inputClass}
            />
            {passwordError && <p className="mt-1 text-xs text-neon-pink">{passwordError}</p>}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full rounded-lg bg-neon-pink px-5 py-3 font-semibold text-ink-950 transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}
