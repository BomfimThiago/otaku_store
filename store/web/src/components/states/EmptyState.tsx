import type { ReactNode } from 'react';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  title: string;
  message: string;
  action?: EmptyStateAction;
  icon?: ReactNode;
}

export function EmptyState({ title, message, action, icon }: EmptyStateProps) {
  return (
    <section className="flex flex-col items-center gap-3 py-12 text-center text-neutral-300">
      {icon}
      <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
      <p className="text-sm text-neutral-400">{message}</p>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-100"
        >
          {action.label}
        </button>
      ) : null}
    </section>
  );
}
