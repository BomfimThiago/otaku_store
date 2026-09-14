import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext.js';
import { useCart } from '../cart/CartContext.js';
import { useToast } from '../toast/ToastProvider.js';
import { CategoryNav } from './CategoryNav.js';

const SEARCH_DEBOUNCE_MS = 300;

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
      <circle cx="9" cy="9" r="6" />
      <path d="m17.5 17.5-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
      <circle cx="10" cy="6.5" r="3.5" />
      <path d="M3 17c1.1-3.6 3.9-5.3 7-5.3s5.9 1.7 7 5.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
      <path
        d="M2.5 3h2l1.6 9.7a2 2 0 0 0 2 1.6h6.3a2 2 0 0 0 2-1.6L17.5 6.5H5.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="17" r="1.3" />
      <circle cx="14.5" cy="17" r="1.3" />
    </svg>
  );
}

export function Header() {
  const { itemCount } = useCart();
  const { user, loading, logout } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isHome = location.pathname === '/';
  const [q, setQ] = useState(() => searchParams.get('q') ?? '');

  // Keep the input in sync when the URL changes from elsewhere (category
  // nav, browser back/forward, direct navigation).
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

  const handleLogout = async () => {
    await logout();
    toast.show('Você saiu da sua conta', { variant: 'success' });
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-ink-700 bg-ink-900/90 shadow-sm backdrop-blur">
      <div className="flex w-full flex-wrap items-center gap-4 px-4 py-3 md:px-8">
        <Link
          to="/"
          className="shrink-0 font-display text-xl font-bold text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
        >
          Otaku<span className="text-neon-pink">Verso</span>
        </Link>

        <form
          role="search"
          aria-label="Buscar produtos"
          onSubmit={handleSubmit}
          className="order-last flex w-full flex-1 md:order-none md:w-auto"
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
            className="flex h-11 shrink-0 items-center justify-center rounded-r-lg bg-neon-pink px-4 text-white transition hover:brightness-110"
          >
            <SearchIcon />
          </button>
        </form>

        <div className="flex shrink-0 items-center gap-4">
          {!loading &&
            (user ? (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                  <UserIcon />
                  {user.name}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-sm text-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
                >
                  Sair
                </button>
              </div>
            ) : (
              <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
                <UserIcon />
                Entrar
              </Link>
            ))}

          <Link
            to="/cart"
            className="relative inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
          >
            <CartIcon />
            Carrinho
            {itemCount > 0 && (
              <span className="rounded-full bg-neon-pink px-2 py-0.5 text-xs font-bold text-white tabular-nums">
                {itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      <CategoryNav />
    </header>
  );
}
