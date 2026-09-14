import { Link } from 'react-router';
import { useCart } from '../cart/CartContext.js';
import { formatPrice } from '../lib/format.js';
import { EmptyState } from '../components/states/EmptyState.js';

export function CartPage() {
  const { items, subtotalCents, totalCents, loading, updateItem, removeItem } = useCart();

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="h-40 animate-pulse rounded-xl bg-ink-800" />
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          title="Seu carrinho está vazio"
          message="Explore o catálogo e adicione seus colecionáveis favoritos."
        />
        <div className="mt-6 text-center">
          <Link to="/" className="text-neon-cyan hover:underline">
            Ver catálogo
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 font-display text-2xl font-bold">Carrinho</h1>
      <ul className="space-y-3">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex items-center gap-4 rounded-xl border border-ink-700 bg-ink-900 p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-fg">{it.name}</p>
              <p className="text-sm text-muted">{formatPrice(it.unitPriceCents)} cada</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                aria-label="Diminuir quantidade"
                onClick={() => it.quantity > 1 && updateItem(it.id, it.quantity - 1)}
                className="h-8 w-8 rounded-lg bg-ink-800 text-fg hover:bg-ink-700"
              >
                −
              </button>
              <span className="w-6 text-center tabular-nums">{it.quantity}</span>
              <button
                aria-label="Aumentar quantidade"
                onClick={() => updateItem(it.id, it.quantity + 1)}
                className="h-8 w-8 rounded-lg bg-ink-800 text-fg hover:bg-ink-700"
              >
                +
              </button>
            </div>
            <p className="w-24 text-right font-bold text-neon-pink">{formatPrice(it.lineTotalCents)}</p>
            <button
              aria-label={`Remover ${it.name}`}
              onClick={() => removeItem(it.id)}
              className="text-muted hover:text-neon-pink"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-xl border border-ink-700 bg-ink-900 p-4 text-sm">
        <div className="flex justify-between text-muted">
          <span>Subtotal</span>
          <span>{formatPrice(subtotalCents)}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>Frete</span>
          <span>{formatPrice(totalCents - subtotalCents)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-ink-700 pt-2 text-base font-bold text-fg">
          <span>Total</span>
          <span className="text-neon-pink">{formatPrice(totalCents)}</span>
        </div>
      </div>
    </main>
  );
}
