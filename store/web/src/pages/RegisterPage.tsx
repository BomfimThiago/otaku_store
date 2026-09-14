import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { ApiError } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.js';
import { isValidEmail, isValidPassword } from '../auth/validation.js';
import { useToast } from '../toast/ToastProvider.js';

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

function validate(name: string, email: string, password: string, confirmPassword: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!name.trim()) {
    errors.name = 'Informe seu nome.';
  }
  if (!email.trim()) {
    errors.email = 'Informe seu e-mail.';
  } else if (!isValidEmail(email)) {
    errors.email = 'Informe um e-mail válido.';
  }
  if (!password) {
    errors.password = 'Informe uma senha.';
  } else if (!isValidPassword(password)) {
    errors.password = 'A senha deve ter ao menos 8 caracteres, com letras e números.';
  }
  if (!confirmPassword) {
    errors.confirmPassword = 'Confirme sua senha.';
  } else if (confirmPassword !== password) {
    errors.confirmPassword = 'As senhas não coincidem.';
  }
  return errors;
}

const inputClass =
  'mt-1 h-11 w-full rounded-lg border border-ink-700 bg-ink-800 px-4 text-sm text-fg placeholder:text-muted focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan';

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState<{
    name: boolean;
    email: boolean;
    password: boolean;
    confirmPassword: boolean;
  }>({ name: false, email: false, password: false, confirmPassword: false });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const errors = validate(name, email, password, confirmPassword);
  const nameError = touched.name || submitted ? errors.name : undefined;
  const emailError = touched.email || submitted ? errors.email : undefined;
  const passwordError = touched.password || submitted ? errors.password : undefined;
  const confirmPasswordError = touched.confirmPassword || submitted ? errors.confirmPassword : undefined;

  const handleBlur = (field: keyof typeof touched) => () => {
    setTouched((t) => ({ ...t, [field]: true }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    setFormError(null);

    if (Object.keys(validate(name, email, password, confirmPassword)).length > 0) {
      return;
    }

    setBusy(true);
    try {
      const created = await register({ name, email, password });
      toast.show(`Bem-vindo(a), ${created.name}!`, { variant: 'success' });
      navigate('/');
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 409
            ? 'E-mail já cadastrado'
            : err.message
          : 'Não foi possível criar a conta. Tente novamente.';
      setFormError(message);
      toast.show(message, { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="w-full px-4 py-16 md:px-8">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="font-display text-2xl font-bold text-fg">Criar conta</h1>
        <p className="mt-1 text-sm text-muted">
          Já tem uma conta?{' '}
          <Link to="/login" className="text-neon-cyan hover:underline">
            Entrar
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
            <label htmlFor="name" className="block text-xs text-muted">
              Nome
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleBlur('name')}
              aria-invalid={Boolean(nameError)}
              className={inputClass}
            />
            {nameError && <p className="mt-1 text-xs text-neon-pink">{nameError}</p>}
          </div>

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
              onBlur={handleBlur('email')}
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={handleBlur('password')}
              aria-invalid={Boolean(passwordError)}
              className={inputClass}
            />
            {passwordError && <p className="mt-1 text-xs text-neon-pink">{passwordError}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-xs text-muted">
              Confirmar senha
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={handleBlur('confirmPassword')}
              aria-invalid={Boolean(confirmPasswordError)}
              className={inputClass}
            />
            {confirmPasswordError && <p className="mt-1 text-xs text-neon-pink">{confirmPasswordError}</p>}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full rounded-lg bg-neon-pink px-5 py-3 font-semibold text-ink-950 transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? 'Criando conta…' : 'Criar conta'}
          </button>
        </form>
      </div>
    </main>
  );
}
