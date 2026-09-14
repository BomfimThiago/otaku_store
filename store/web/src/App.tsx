import { useEffect, useState, type FormEvent } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useCart } from './cart/CartContext.js';
import { HomePage } from './pages/HomePage.js';
import { ProductPage } from './pages/ProductPage.js';
import { CartPage } from './pages/CartPage.js';

const SEARCH_DEBOUNCE_MS = 300;

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
      <circle cx="9" cy="9" r="6" />
      <path d="m17.5 17.5-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}

function Header() {
  const { itemCount } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isHome = location.pathname === '/';
  const [q, setQ] = useState(() => searchParams.get('q') ?? '');

  // Keep the input in sync when the URL changes from elsewhere (category
  // chips, browser back/forward, direct navigation).
  useEffect(() => {
    setQ(searchParams.get('q') ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // While on the catalog, push typed queries into ?q= with a short debounce
  // so the URL stays the source of truth without a navigation per keystroke.
  useEffect(() => {
    if (!isHome) return;
    const trimmed = q.trim();
    if (trimmed === (searchParams.get('q') ?? '')) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (trimmed) {
        next.set('q', trimmed);
      } else {
        next.delete('q');
      }
      setSearchParams(next, { replace: true });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, isHome]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = q.trim();
    navigate(trimmed ? `/?q=${encodeURIComponent(trimmed)}` : '/');
  };

  return (
    <header className="sticky top-0 z-20 w-full border-b border-ink-700 bg-ink-900/90 backdrop-blur">
      <div className="flex w-full flex-wrap items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="shrink-0 font-display text-xl font-bold text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
        >
          Otaku<span className="text-neon-pink">Verso</span>
        </Link>

        <form
          role="search"
          onSubmit={handleSubmit}
          className="order-last flex w-full md:order-none md:w-auto md:flex-1"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar produtos…"
            aria-label="Buscar produtos"
            className="h-11 w-full rounded-l-lg border border-ink-700 bg-ink-800 px-4 text-sm text-fg placeholder:text-muted focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan"
          />
          <button
            type="submit"
            aria-label="Buscar"
            className="flex h-11 shrink-0 items-center justify-center rounded-r-lg bg-neon-pink px-4 text-ink-950 transition hover:brightness-110"
          >
            <SearchIcon />
          </button>
        </form>

        <Link
          to="/cart"
          className="relative inline-flex shrink-0 items-center gap-1 text-sm text-muted hover:text-fg"
        >
          Carrinho
          {itemCount > 0 && (
            <span className="rounded-full bg-neon-pink px-2 py-0.5 text-xs font-bold text-ink-950 tabular-nums">
              {itemCount}
            </span>
          )}
        </Link>
      </div>
      <div className="w-full border-t border-ink-800 px-4 py-2 sm:px-6 lg:px-8">
        <nav className="text-sm">
          <Link to="/" className="text-muted hover:text-fg">
            Catálogo
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function App() {
  return (
    <div className="min-h-screen bg-ink-950 text-fg">
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/p/:slug" element={<ProductPage />} />
        <Route path="/cart" element={<CartPage />} />
      </Routes>
    </div>
  );
}
