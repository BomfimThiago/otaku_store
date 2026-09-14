interface SkeletonProps {
  count?: number;
  label?: string;
  className?: string;
}

function toItemCount(count: number | undefined): number {
  return Math.max(0, count ?? 1);
}

export function Skeleton({ count, label, className }: SkeletonProps) {
  const items = Array.from({ length: toItemCount(count) }, (_, index) => index);
  const wrapperClassName = ['flex flex-col gap-2', className].filter(Boolean).join(' ');

  return (
    <div role="status" aria-busy="true" aria-label={label ?? 'Carregando…'} className={wrapperClassName}>
      {items.map((index) => (
        <div
          key={index}
          data-testid="skeleton-item"
          aria-hidden="true"
          className="h-4 w-full animate-pulse motion-reduce:animate-none rounded bg-neutral-800"
        />
      ))}
    </div>
  );
}

interface ProductCardSkeletonProps {
  count?: number;
  label?: string;
}

export function ProductCardSkeleton({ count, label }: ProductCardSkeletonProps) {
  const items = Array.from({ length: toItemCount(count) }, (_, index) => index);

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label ?? 'Carregando…'}
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
    >
      {items.map((index) => (
        <div
          key={index}
          data-testid="skeleton-item"
          aria-hidden="true"
          className="flex flex-col gap-2 rounded border border-neutral-800 p-3"
        >
          <div className="aspect-square w-full animate-pulse motion-reduce:animate-none rounded bg-neutral-800" />
          <div className="h-4 w-3/4 animate-pulse motion-reduce:animate-none rounded bg-neutral-800" />
          <div className="h-4 w-1/3 animate-pulse motion-reduce:animate-none rounded bg-neutral-800" />
        </div>
      ))}
    </div>
  );
}
