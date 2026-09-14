import { Link, useSearchParams } from 'react-router';
import { CATEGORIES, categoryLabel, PRICE_RANGES, type CategorySlug } from '../lib/categories.js';

function linkClasses(active: boolean) {
  return `block rounded-lg px-3 py-1.5 text-sm ${
    active ? 'bg-ink-800 text-neon-cyan' : 'text-muted hover:text-fg'
  }`;
}

export function CatalogSidebar() {
  const [searchParams] = useSearchParams();
  const activeCategory = searchParams.get('category');
  const activeMin = searchParams.get('min');
  const activeMax = searchParams.get('max');

  const categoryHref = (slug: CategorySlug | null) => {
    const next = new URLSearchParams(searchParams);
    if (slug) {
      next.set('category', slug);
    } else {
      next.delete('category');
    }
    const search = next.toString();
    return { pathname: '/', search: search ? `?${search}` : '' };
  };

  const priceHref = (min?: number, max?: number) => {
    const next = new URLSearchParams(searchParams);
    if (min !== undefined) {
      next.set('min', String(min));
    } else {
      next.delete('min');
    }
    if (max !== undefined) {
      next.set('max', String(max));
    } else {
      next.delete('max');
    }
    const search = next.toString();
    return { pathname: '/', search: search ? `?${search}` : '' };
  };

  const isPriceActive = (min?: number, max?: number) => {
    const wantMin = min !== undefined ? String(min) : null;
    const wantMax = max !== undefined ? String(max) : null;
    return activeMin === wantMin && activeMax === wantMax;
  };

  return (
    <aside aria-label="Filtros" className="w-full md:sticky md:top-32 md:w-60 md:shrink-0">
      <div className="rounded-xl border border-ink-700 bg-ink-900 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Categoria</p>
        <ul className="mt-2 space-y-1">
          <li>
            <Link
              to={categoryHref(null)}
              aria-current={activeCategory === null ? 'page' : undefined}
              className={linkClasses(activeCategory === null)}
            >
              Todas
            </Link>
          </li>
          {CATEGORIES.map((slug) => (
            <li key={slug}>
              <Link
                to={categoryHref(slug)}
                aria-current={activeCategory === slug ? 'page' : undefined}
                className={linkClasses(activeCategory === slug)}
              >
                {categoryLabel(slug)}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-xl border border-ink-700 bg-ink-900 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Preço</p>
        <ul className="mt-2 space-y-1">
          <li>
            <Link
              to={priceHref()}
              aria-current={isPriceActive() ? 'page' : undefined}
              className={linkClasses(isPriceActive())}
            >
              Qualquer preço
            </Link>
          </li>
          {PRICE_RANGES.map((range) => (
            <li key={range.id}>
              <Link
                to={priceHref(range.min, range.max)}
                aria-current={isPriceActive(range.min, range.max) ? 'page' : undefined}
                className={linkClasses(isPriceActive(range.min, range.max))}
              >
                {range.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
