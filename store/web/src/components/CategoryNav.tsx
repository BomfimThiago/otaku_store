import { Link, useLocation, useSearchParams } from 'react-router';
import { CATEGORIES, categoryLabel, type CategorySlug } from '../lib/categories.js';

function itemClasses(active: boolean) {
  return `inline-block whitespace-nowrap border-b-2 px-1 py-2 text-sm ${
    active ? 'border-neon-cyan text-neon-cyan' : 'border-transparent text-muted hover:text-fg'
  }`;
}

export function CategoryNav() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isHome = location.pathname === '/';
  const activeCategory = searchParams.get('category');

  const isActive = (slug: CategorySlug | null) =>
    isHome && (slug === null ? activeCategory === null : activeCategory === slug);

  return (
    <nav aria-label="Categorias" className="w-full border-t border-ink-800">
      <ul className="flex w-full items-center gap-4 overflow-x-auto px-4 md:px-8">
        <li>
          <Link
            to="/"
            aria-current={isActive(null) ? 'page' : undefined}
            className={itemClasses(isActive(null))}
          >
            Todos
          </Link>
        </li>
        {CATEGORIES.map((slug) => (
          <li key={slug}>
            <Link
              to={{ pathname: '/', search: `?category=${slug}` }}
              aria-current={isActive(slug) ? 'page' : undefined}
              className={itemClasses(isActive(slug))}
            >
              {categoryLabel(slug)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
