import { beforeEach, describe, expect, it } from 'vitest';

import { createReviewsStore, ReviewsError, SEED_REVIEWS } from '../src/data/reviews.js';
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

describe('SEED_REVIEWS', () => {
  it('has at least 5 distinct real product slugs, each with 2-4 reviews', () => {
    const bySlug = new Map<string, number>();
    for (const review of SEED_REVIEWS) {
      bySlug.set(review.productSlug, (bySlug.get(review.productSlug) ?? 0) + 1);
    }

    expect(bySlug.size).toBeGreaterThanOrEqual(5);
    for (const count of bySlug.values()) {
      expect(count).toBeGreaterThanOrEqual(2);
      expect(count).toBeLessThanOrEqual(4);
    }
  });

  it('has integer ratings from 3 to 5 for every review', () => {
    for (const review of SEED_REVIEWS) {
      expect(Number.isInteger(review.rating)).toBe(true);
      expect(review.rating).toBeGreaterThanOrEqual(3);
      expect(review.rating).toBeLessThanOrEqual(5);
    }
  });

  it('uses several distinct display names', () => {
    const names = new Set(SEED_REVIEWS.map((review) => review.userName));
    expect(names.size).toBeGreaterThanOrEqual(6);
  });
});

describe('createReviewsStore() default seeding', () => {
  it('exposes SEED_REVIEWS by default', () => {
    const defaultStore = createReviewsStore();

    const slugs = new Set(SEED_REVIEWS.map((review) => review.productSlug));
    for (const slug of slugs) {
      const seeded = SEED_REVIEWS.filter((review) => review.productSlug === slug);
      const listed = defaultStore.listByProduct(slug);
      expect(listed).toHaveLength(seeded.length);
      expect(new Set(listed.map((review) => review.id))).toEqual(new Set(seeded.map((review) => review.id)));
    }
  });

  it('returns seeded reviews newest first and a matching aggregate', () => {
    const defaultStore = createReviewsStore();
    const slug = SEED_REVIEWS[0]!.productSlug;
    const seeded = SEED_REVIEWS.filter((review) => review.productSlug === slug);

    const listed = defaultStore.listByProduct(slug);
    const expectedOrder = [...seeded].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    expect(listed.map((review) => review.id)).toEqual(expectedOrder.map((review) => review.id));

    const sum = seeded.reduce((total, review) => total + review.rating, 0);
    const expectedAverage = Math.round((sum / seeded.length) * 10) / 10;
    expect(defaultStore.getAggregate(slug)).toEqual({ average: expectedAverage, count: seeded.length });
  });

  it('createReviewsStore({ seed: [] }) starts empty', () => {
    const emptyStore = createReviewsStore({ seed: [] });

    const slug = SEED_REVIEWS[0]!.productSlug;
    expect(emptyStore.listByProduct(slug)).toEqual([]);
    expect(emptyStore.getAggregate(slug)).toEqual({ average: 0, count: 0 });
  });

  it('does not share seed arrays between two stores, or with SEED_REVIEWS', () => {
    const slug = SEED_REVIEWS[0]!.productSlug;
    const originalCount = SEED_REVIEWS.filter((review) => review.productSlug === slug).length;

    const storeA = createReviewsStore({ generateId: createIdGenerator() });
    const storeB = createReviewsStore({ generateId: createIdGenerator() });

    storeA.addReview({ productSlug: slug, userId: 'new-user-1', userName: 'New Fan', rating: 5, comment: 'Novo!' });

    expect(storeA.listByProduct(slug)).toHaveLength(originalCount + 1);
    expect(storeB.listByProduct(slug)).toHaveLength(originalCount);
    expect(SEED_REVIEWS.filter((review) => review.productSlug === slug)).toHaveLength(originalCount);
  });

  it('prepends a new review on a seeded slug and updates the aggregate', () => {
    const defaultStore = createReviewsStore();
    const slug = SEED_REVIEWS[0]!.productSlug;
    const seeded = SEED_REVIEWS.filter((review) => review.productSlug === slug);

    const created = defaultStore.addReview({
      productSlug: slug,
      userId: 'brand-new-user',
      userName: 'Nova Fã',
      rating: 5,
      comment: 'Chegou hoje e já é meu favorito!',
    });

    const listed = defaultStore.listByProduct(slug);
    expect(listed[0]).toEqual(created);
    expect(listed).toHaveLength(seeded.length + 1);

    const sum = seeded.reduce((total, review) => total + review.rating, 0) + 5;
    const expectedAverage = Math.round((sum / (seeded.length + 1)) * 10) / 10;
    expect(defaultStore.getAggregate(slug)).toEqual({ average: expectedAverage, count: seeded.length + 1 });
  });
});
