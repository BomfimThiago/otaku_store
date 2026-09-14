const DEFAULT_MESSAGE = 'Não foi possível carregar. Verifique sua conexão.';

interface ErrorStateProps {
  message?: string;
  title?: string;
  onRetry: () => void;
  retryLabel?: string;
}

export function ErrorState({ message, title, onRetry, retryLabel }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded border border-red-900 bg-red-950/40 py-12 text-center text-neutral-300"
    >
      {title ? <h2 className="text-lg font-semibold text-neutral-100">{title}</h2> : null}
      <p className="text-sm text-neutral-300">{message ?? DEFAULT_MESSAGE}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-100"
      >
        {retryLabel ?? 'Tentar novamente'}
      </button>
    </div>
  );
}
