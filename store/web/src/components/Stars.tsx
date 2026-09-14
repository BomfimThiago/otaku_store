export interface StarsProps {
  value: number;
  max?: number;
  count?: number;
  size?: 'sm' | 'md';
}

/** Formats a rating for the accessible label: "3.6", but "4" (not "4.0"). */
function formatValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function Stars({ value, max = 5, count, size = 'md' }: StarsProps) {
  const filledCount = Math.min(max, Math.max(0, Math.round(value)));
  const sizeClass = size === 'sm' ? 'text-xs' : 'text-base';

  return (
    <span className="inline-flex items-center gap-1">
      <span
        role="img"
        aria-label={`Nota ${formatValue(value)} de ${max}`}
        className={`inline-flex ${sizeClass}`}
      >
        {Array.from({ length: max }, (_, index) => {
          const filled = index < filledCount;
          return (
            <span
              key={index}
              aria-hidden="true"
              data-testid={filled ? 'star-filled' : 'star-empty'}
              className={filled ? 'text-neon-cyan' : 'text-ink-600'}
            >
              {filled ? '★' : '☆'}
            </span>
          );
        })}
      </span>
      {count !== undefined && <span className="text-xs text-muted">({count})</span>}
    </span>
  );
}
