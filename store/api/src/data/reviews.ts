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
}

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
  const reviewsBySlug = new Map<string, Review[]>();

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
