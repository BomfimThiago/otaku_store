import { beforeEach, describe, expect, it } from 'vitest';

import { createReviewsStore, ReviewsError } from '../src/data/reviews.js';
import type { ReviewsStore } from '../src/data/reviews.js';

function createIdGenerator(): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `review-${counter}`;
  };
}

describe('createReviewsStore', () => {
  let store: ReviewsStore;

  beforeEach(() => {
    store = createReviewsStore({ generateId: createIdGenerator() });
  });

  describe('addReview', () => {
    it('returns a copy with an id and createdAt', () => {
      const review = store.addReview({
        productSlug: 'katana-x',
        userId: 'user-1',
        userName: 'Ada',
        rating: 5,
        comment: 'Ótimo produto!',
      });

      expect(review).toEqual({
        id: 'review-1',
        productSlug: 'katana-x',
        userId: 'user-1',
        userName: 'Ada',
        rating: 5,
        comment: 'Ótimo produto!',
        createdAt: expect.any(String),
      });
      expect(new Date(review.createdAt).toString()).not.toBe('Invalid Date');
    });

    it('throws ReviewsError with statusCode 409 and code ALREADY_REVIEWED for the same userId + productSlug twice', () => {
      store.addReview({ productSlug: 'katana-x', userId: 'user-1', userName: 'Ada', rating: 5, comment: 'a' });

      expect.assertions(3);
      try {
        store.addReview({ productSlug: 'katana-x', userId: 'user-1', userName: 'Ada', rating: 4, comment: 'b' });
      } catch (error) {
        expect(error).toBeInstanceOf(ReviewsError);
        expect((error as ReviewsError).statusCode).toBe(409);
        expect((error as ReviewsError).code).toBe('ALREADY_REVIEWED');
      }
    });

    it('allows the same userId to review different products', () => {
      store.addReview({ productSlug: 'katana-x', userId: 'user-1', userName: 'Ada', rating: 5, comment: 'a' });

      expect(() =>
        store.addReview({ productSlug: 'other-slug', userId: 'user-1', userName: 'Ada', rating: 4, comment: 'b' }),
      ).not.toThrow();
    });

    it('allows different users to review the same product', () => {
      store.addReview({ productSlug: 'katana-x', userId: 'user-1', userName: 'Ada', rating: 5, comment: 'a' });

      expect(() =>
        store.addReview({ productSlug: 'katana-x', userId: 'user-2', userName: 'Bob', rating: 3, comment: 'b' }),
      ).not.toThrow();
    });
  });

  describe('listByProduct', () => {
    it('returns an empty array for a product with no reviews', () => {
      expect(store.listByProduct('katana-x')).toEqual([]);
    });

    it('returns reviews newest first', () => {
      const first = store.addReview({
        productSlug: 'katana-x',
        userId: 'user-1',
        userName: 'Ada',
        rating: 5,
        comment: 'a',
      });
      const second = store.addReview({
        productSlug: 'katana-x',
        userId: 'user-2',
        userName: 'Bob',
        rating: 3,
        comment: 'b',
      });

      expect(store.listByProduct('katana-x')).toEqual([second, first]);
    });

    it('returns copies that cannot mutate the store', () => {
      store.addReview({ productSlug: 'katana-x', userId: 'user-1', userName: 'Ada', rating: 5, comment: 'a' });

      const list = store.listByProduct('katana-x');
      list[0]!.comment = 'tampered';

      expect(store.listByProduct('katana-x')[0]!.comment).toBe('a');
    });
  });

  describe('getAggregate', () => {
    it('returns {average: 0, count: 0} for a product with no reviews', () => {
      expect(store.getAggregate('katana-x')).toEqual({ average: 0, count: 0 });
    });

    it('rounds the average to 1 decimal', () => {
      store.addReview({ productSlug: 'katana-x', userId: 'user-1', userName: 'Ada', rating: 5, comment: 'a' });
      store.addReview({ productSlug: 'katana-x', userId: 'user-2', userName: 'Bob', rating: 4, comment: 'b' });
      store.addReview({ productSlug: 'katana-x', userId: 'user-3', userName: 'Cy', rating: 4, comment: 'c' });

      // (5 + 4 + 4) / 3 = 4.333... -> 4.3
      expect(store.getAggregate('katana-x')).toEqual({ average: 4.3, count: 3 });
    });
  });

  describe('isolation', () => {
    it('does not share state between two stores from createReviewsStore()', () => {
      const otherStore = createReviewsStore({ generateId: createIdGenerator() });

      store.addReview({ productSlug: 'katana-x', userId: 'user-1', userName: 'Ada', rating: 5, comment: 'a' });

      expect(otherStore.listByProduct('katana-x')).toEqual([]);
    });
  });
});
