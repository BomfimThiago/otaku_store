import { Link, Route, Routes } from 'react-router';
import { useCart } from './cart/CartContext.js';
import { HomePage } from './pages/HomePage.js';
import { ProductPage } from './pages/ProductPage.js';
import { CartPage } from './pages/CartPage.js';

function Header() {
  const { itemCount } = useCart();
  return (
    <header className="sticky top-0 z-20 border-b border-ink-700 bg-ink-900/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link
          to="/"
          className="font-display text-xl font-bold text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
        >
          Otaku<span className="text-neon-pink">Verso</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link to="/" className="text-muted hover:text-fg">
            Catálogo
          </Link>
          <Link to="/cart" className="relative inline-flex items-center gap-1 text-muted hover:text-fg">
            Carrinho
            {itemCount > 0 && (
              <span className="rounded-full bg-neon-pink px-2 py-0.5 text-xs font-bold text-ink-950 tabular-nums">
                {itemCount}
              </span>
            )}
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
