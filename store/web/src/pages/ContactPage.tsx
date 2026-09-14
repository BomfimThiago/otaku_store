import { useState, type FormEvent } from 'react';
import { isValidEmail } from '../auth/validation.js';
import { useToast } from '../toast/ToastProvider.js';

interface ContactValues {
  name: string;
  email: string;
  message: string;
}

type FieldErrors = { name?: string; email?: string; message?: string };

const MESSAGE_MIN_LENGTH = 10;

const initialValues: ContactValues = { name: '', email: '', message: '' };
const initialTouched: { name: boolean; email: boolean; message: boolean } = {
  name: false,
  email: false,
  message: false,
};

function validate(values: ContactValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.name.trim()) {
    errors.name = 'Informe seu nome.';
  }
  if (!values.email.trim()) {
    errors.email = 'Informe seu e-mail.';
  } else if (!isValidEmail(values.email)) {
    errors.email = 'Informe um e-mail válido.';
  }
  if (!values.message.trim()) {
    errors.message = 'Informe sua mensagem.';
  } else if (values.message.trim().length < MESSAGE_MIN_LENGTH) {
    errors.message = 'A mensagem deve ter pelo menos 10 caracteres.';
  }
  return errors;
}

const inputClass =
  'mt-1 h-11 w-full rounded-lg border border-ink-700 bg-ink-800 px-4 text-sm text-fg placeholder:text-muted focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan';

const textareaClass =
  'mt-1 w-full rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm text-fg placeholder:text-muted focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan';

export function ContactPage() {
  const toast = useToast();

  const [values, setValues] = useState<ContactValues>(initialValues);
  const [touched, setTouched] = useState(initialTouched);
  const [submitted, setSubmitted] = useState(false);

  const errors = validate(values);
  const nameError = touched.name || submitted ? errors.name : undefined;
  const emailError = touched.email || submitted ? errors.email : undefined;
  const messageError = touched.message || submitted ? errors.message : undefined;

  const handleBlur = (field: keyof typeof touched) => () => {
    setTouched((t) => ({ ...t, [field]: true }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);

    if (Object.keys(validate(values)).length > 0) {
      return;
    }

    toast.show('Mensagem enviada! Responderemos em breve.', { variant: 'success' });
    setValues(initialValues);
    setTouched(initialTouched);
    setSubmitted(false);
  };

  return (
    <main className="w-full px-4 py-16 md:px-8">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="font-display text-2xl font-bold text-fg">Fale conosco</h1>
        <p className="mt-1 text-sm text-muted">
          Tem alguma dúvida, sugestão ou problema? Envie uma mensagem e responderemos em breve.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor="name" className="block text-xs text-muted">
              Nome
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
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
              value={values.email}
              onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
              onBlur={handleBlur('email')}
              aria-invalid={Boolean(emailError)}
              className={inputClass}
            />
            {emailError && <p className="mt-1 text-xs text-neon-pink">{emailError}</p>}
          </div>

          <div>
            <label htmlFor="message" className="block text-xs text-muted">
              Mensagem
            </label>
            <textarea
              id="message"
              rows={4}
              value={values.message}
              onChange={(e) => setValues((v) => ({ ...v, message: e.target.value }))}
              onBlur={handleBlur('message')}
              aria-invalid={Boolean(messageError)}
              className={textareaClass}
            />
            {messageError && <p className="mt-1 text-xs text-neon-pink">{messageError}</p>}
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-lg bg-neon-pink px-5 py-3 font-semibold text-white transition hover:brightness-110"
          >
            Enviar mensagem
          </button>
        </form>
      </div>
    </main>
  );
}
