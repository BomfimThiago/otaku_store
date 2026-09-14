/**
 * In-memory reviews store.
 *
 * Rules:
 *  - Reviews are keyed by product slug; each slug maps to a list of reviews.
 *    `listByProduct` returns them newest first.
 *  - A user may review a given product at most once. Adding a second review
 *    for the same userId + productSlug throws `ReviewsError` with
 *    statusCode 409 and code 'ALREADY_REVIEWED'.
 *  - `getAggregate` returns `{ average: 0, count: 0 }` for a product with no
 *    reviews. Otherwise `average` is the mean rating rounded to 1 decimal
 *    (`Math.round(sum / count * 10) / 10`).
 *  - Every value returned to callers (`listByProduct`, `addReview`) is a
 *    copy, so mutating it can never affect the store.
 *  - `createReviewsStore` seeds itself from the `seed` option, which
 *    defaults to `SEED_REVIEWS` (realistic pt-BR reviews for a handful of
 *    real product slugs). The seed is grouped by productSlug, sorted newest
 *    first, and copied into the store's internal Map so the store never
 *    holds references to the seed array or its objects; mutating a store
 *    (or another store created from the same default seed) can never affect
 *    `SEED_REVIEWS` or any other store. Pass `seed: []` for a store with no
 *    seeded reviews.
 */
import { randomUUID } from 'node:crypto';

export interface Review {
  id: string;
  productSlug: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface ReviewAggregate {
  average: number;
  count: number;
}

export interface AddReviewInput {
  productSlug: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
}

export interface ReviewsStoreOptions {
  generateId?: () => string;
  now?: () => Date;
  seed?: readonly Review[];
}

/**
 * Realistic pt-BR seed reviews for a handful of real product slugs (see
 * src/data/products.ts). Used as the default `seed` for `createReviewsStore`
 * so the storefront never looks empty. Ids and userIds are fixed
 * (`seed-review-N` / `seed-user-<name>`) so they can never collide with
 * `randomUUID()`-generated ids, and `createdAt` values are fixed past ISO
 * dates so ordering is deterministic.
 */
export const SEED_REVIEWS: readonly Review[] = [
  // nendoroid-goku-super-saiyajin
  {
    id: 'seed-review-1',
    productSlug: 'nendoroid-goku-super-saiyajin',
    userId: 'seed-user-mariana-s',
    userName: 'Mariana S.',
    rating: 5,
    comment: 'Chegou rápido e o acabamento do Goku ficou impecável, super recomendo!',
    createdAt: '2024-11-02T13:20:00.000Z',
  },
  {
    id: 'seed-review-2',
    productSlug: 'nendoroid-goku-super-saiyajin',
    userId: 'seed-user-lucas-ferreira',
    userName: 'Lucas Ferreira',
    rating: 4,
    comment: 'Boneco bonito, mas as peças de rosto trocáveis são um pouco apertadas.',
    createdAt: '2024-11-15T09:05:00.000Z',
  },
  {
    id: 'seed-review-3',
    productSlug: 'nendoroid-goku-super-saiyajin',
    userId: 'seed-user-yuki-tanaka',
    userName: 'Yuki Tanaka',
    rating: 5,
    comment: 'Pintura caprichada e embalagem original, valeu cada centavo.',
    createdAt: '2024-12-01T18:40:00.000Z',
  },
  {
    id: 'seed-review-4',
    productSlug: 'nendoroid-goku-super-saiyajin',
    userId: 'seed-user-rafael-m',
    userName: 'Rafael M.',
    rating: 3,
    comment: 'Gostei do produto, porém demorou mais que o esperado pra chegar.',
    createdAt: '2025-01-10T11:15:00.000Z',
  },
  // figuarts-luffy-gear-5
  {
    id: 'seed-review-5',
    productSlug: 'figuarts-luffy-gear-5',
    userId: 'seed-user-camila-rocha',
    userName: 'Camila Rocha',
    rating: 5,
    comment: 'Articulação perfeita, a pose do Gear 5 ficou incrível na estante!',
    createdAt: '2024-10-20T16:00:00.000Z',
  },
  {
    id: 'seed-review-6',
    productSlug: 'figuarts-luffy-gear-5',
    userId: 'seed-user-bruno-otaku',
    userName: 'Bruno Otaku',
    rating: 4,
    comment: 'Ótimo acabamento, só achei o preço salgado.',
    createdAt: '2024-11-05T08:30:00.000Z',
  },
  {
    id: 'seed-review-7',
    productSlug: 'figuarts-luffy-gear-5',
    userId: 'seed-user-mariana-s',
    userName: 'Mariana S.',
    rating: 5,
    comment: 'Já é o segundo Figuarts que compro, qualidade sempre top.',
    createdAt: '2024-12-20T20:10:00.000Z',
  },
  // one-piece-volume-1
  {
    id: 'seed-review-8',
    productSlug: 'one-piece-volume-1',
    userId: 'seed-user-lucas-ferreira',
    userName: 'Lucas Ferreira',
    rating: 5,
    comment: 'Papel de boa qualidade e tradução impecável, mal posso esperar pelo volume 2.',
    createdAt: '2024-09-18T12:45:00.000Z',
  },
  {
    id: 'seed-review-9',
    productSlug: 'one-piece-volume-1',
    userId: 'seed-user-fernanda-lima',
    userName: 'Fernanda Lima',
    rating: 4,
    comment: 'Edição bonita, chegou bem protegida.',
    createdAt: '2024-10-02T14:25:00.000Z',
  },
  // attack-on-titan-box-set
  {
    id: 'seed-review-10',
    productSlug: 'attack-on-titan-box-set',
    userId: 'seed-user-yuki-tanaka',
    userName: 'Yuki Tanaka',
    rating: 5,
    comment: 'Box lindo, o pôster exclusivo é um mimo à parte.',
    createdAt: '2024-08-14T10:00:00.000Z',
  },
  {
    id: 'seed-review-11',
    productSlug: 'attack-on-titan-box-set',
    userId: 'seed-user-rafael-m',
    userName: 'Rafael M.',
    rating: 4,
    comment: 'Muito bom, só um volume veio com a capa levemente amassada.',
    createdAt: '2024-09-01T17:50:00.000Z',
  },
  {
    id: 'seed-review-12',
    productSlug: 'attack-on-titan-box-set',
    userId: 'seed-user-diego-souza',
    userName: 'Diego Souza',
    rating: 5,
    comment: 'Presente perfeito para quem é fã da série, chegou muito bem embalado.',
    createdAt: '2024-09-25T19:35:00.000Z',
  },
  // pelucia-pikachu-30cm
  {
    id: 'seed-review-13',
    productSlug: 'pelucia-pikachu-30cm',
    userId: 'seed-user-camila-rocha',
    userName: 'Camila Rocha',
    rating: 5,
    comment: 'Pelúcia super macia e fofa, meu filho amou de primeira.',
    createdAt: '2024-07-30T15:05:00.000Z',
  },
  {
    id: 'seed-review-14',
    productSlug: 'pelucia-pikachu-30cm',
    userId: 'seed-user-bruno-otaku',
    userName: 'Bruno Otaku',
    rating: 4,
    comment: 'Qualidade boa, tamanho um pouco menor do que eu esperava.',
    createdAt: '2024-08-11T09:20:00.000Z',
  },
  // camiseta-akatsuki-preta
  {
    id: 'seed-review-15',
    productSlug: 'camiseta-akatsuki-preta',
    userId: 'seed-user-mariana-s',
    userName: 'Mariana S.',
    rating: 4,
    comment: 'Tecido confortável e estampa bem definida, só o tamanho veio meio justo.',
    createdAt: '2024-06-05T11:00:00.000Z',
  },
  {
    id: 'seed-review-16',
    productSlug: 'camiseta-akatsuki-preta',
    userId: 'seed-user-fernanda-lima',
    userName: 'Fernanda Lima',
    rating: 5,
    comment: 'Amei a camiseta, o tecido é grosso e a estampa não desbotou depois de lavar.',
    createdAt: '2024-06-22T13:40:00.000Z',
  },
  {
    id: 'seed-review-17',
    productSlug: 'camiseta-akatsuki-preta',
    userId: 'seed-user-diego-souza',
    userName: 'Diego Souza',
    rating: 3,
    comment: 'Estampa bonita mas o tecido é mais fino do que eu imaginava.',
    createdAt: '2024-07-09T16:15:00.000Z',
  },
];

export interface ReviewsStore {
  listByProduct(slug: string): Review[];
  addReview(input: AddReviewInput): Review;
  getAggregate(slug: string): ReviewAggregate;
}

export class ReviewsError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'ReviewsError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function copyReview(review: Review): Review {
  return { ...review };
}

export function createReviewsStore(options: ReviewsStoreOptions = {}): ReviewsStore {
  const generateId = options.generateId ?? randomUUID;
  const now = options.now ?? (() => new Date());
  const seed = options.seed ?? SEED_REVIEWS;
  const reviewsBySlug = new Map<string, Review[]>();

  for (const review of seed) {
    let reviews = reviewsBySlug.get(review.productSlug);
    if (!reviews) {
      reviews = [];
      reviewsBySlug.set(review.productSlug, reviews);
    }
    reviews.push(copyReview(review));
  }
  for (const reviews of reviewsBySlug.values()) {
    reviews.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }

  return {
    listByProduct(slug) {
      const reviews = reviewsBySlug.get(slug) ?? [];
      return reviews.map(copyReview);
    },

    addReview(input) {
      let reviews = reviewsBySlug.get(input.productSlug);
      if (!reviews) {
        reviews = [];
        reviewsBySlug.set(input.productSlug, reviews);
      }

      if (reviews.some((review) => review.userId === input.userId)) {
        throw new ReviewsError(
          409,
          'ALREADY_REVIEWED',
          `User "${input.userId}" already reviewed "${input.productSlug}"`,
        );
      }

      const created: Review = {
        id: generateId(),
        productSlug: input.productSlug,
        userId: input.userId,
        userName: input.userName,
        rating: input.rating,
        comment: input.comment,
        createdAt: now().toISOString(),
      };
      reviews.unshift(created);
      return copyReview(created);
    },

    getAggregate(slug) {
      const reviews = reviewsBySlug.get(slug) ?? [];
      if (reviews.length === 0) return { average: 0, count: 0 };

      const sum = reviews.reduce((total, review) => total + review.rating, 0);
      const average = Math.round((sum / reviews.length) * 10) / 10;
      return { average, count: reviews.length };
    },
  };
}
