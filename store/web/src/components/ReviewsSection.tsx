import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ApiError, createReview, listReviews } from '../api/client.js';
import type { ReviewsResponse } from '../api/types.js';
import { useAuth } from '../auth/AuthContext.js';
import { useToast } from '../toast/ToastProvider.js';
import { Stars } from './Stars.js';

const RATING_OPTIONS = [1, 2, 3, 4, 5];

export function ReviewsSection({ slug }: { slug: string }) {
  const { user } = useAuth();
  const toast = useToast();

  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listReviews(slug)
      .then((result) => {
        if (cancelled) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Erro ao carregar avaliações');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => load(), [load]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (rating === 0 || !comment.trim()) return;

    setFormError(null);
    setSubmitting(true);
    try {
      await createReview(slug, { rating, comment });
      toast.show('Avaliação enviada!', { variant: 'success' });
      setRating(0);
      setComment('');
      load();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Não foi possível enviar sua avaliação. Tente novamente.';
      setFormError(message);
      toast.show(message, { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-label="Avaliações" className="mt-10 border-t border-ink-700 pt-8">
      <h2 className="font-display text-xl font-bold">Avaliações</h2>

      {loading && <p className="mt-2 text-sm text-muted">Carregando avaliações…</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-neon-pink">
          {error}
        </p>
      )}

      {data && (
        <>
          <div data-testid="rating-summary" className="mt-2 flex items-center gap-2">
            <Stars value={data.average} count={data.count} />
          </div>

          {data.reviews.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nenhuma avaliação ainda</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-4">
              {data.reviews.map((review) => (
                <li key={review.id} className="rounded-lg border border-ink-700 bg-ink-900 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-fg">{review.userName}</span>
                    <span className="text-xs text-muted">
                      {new Date(review.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <Stars value={review.rating} />
                  <p className="mt-2 text-sm text-muted">{review.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {user ? (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          {formError && (
            <p
              role="alert"
              className="rounded-lg border border-neon-pink bg-ink-900 px-4 py-3 text-sm text-fg"
            >
              {formError}
            </p>
          )}

          <div className="flex gap-1">
            {RATING_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={rating === n}
                aria-label={`${n} estrelas`}
                onClick={() => setRating(n)}
                className={`text-xl leading-none ${n <= rating ? 'text-neon-cyan' : 'text-ink-700'}`}
              >
                {n <= rating ? '★' : '☆'}
              </button>
            ))}
          </div>

          <label htmlFor="review-comment" className="sr-only">
            Comentário
          </label>
          <textarea
            id="review-comment"
            aria-label="Comentário"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg placeholder:text-muted focus:border-neon-cyan focus:outline-none"
            placeholder="Conte o que você achou do produto"
          />

          <button
            type="submit"
            disabled={submitting || rating === 0 || !comment.trim()}
            className="w-fit rounded-lg bg-neon-pink px-5 py-2 font-semibold text-ink-950 transition hover:brightness-110 disabled:opacity-60"
          >
            {submitting ? 'Enviando…' : 'Enviar avaliação'}
          </button>
        </form>
      ) : (
        <p className="mt-6 text-sm text-muted">
          <Link to="/login" className="text-neon-cyan hover:underline">
            Entre para avaliar
          </Link>
        </p>
      )}
    </section>
  );
}
