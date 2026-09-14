import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ReviewsError } from '../data/reviews.js';
import type { ReviewsStore } from '../data/reviews.js';
import type { UsersStore } from '../data/users.js';
import { products } from '../data/products.js';
import { requireUser } from './auth.js';

export interface ReviewsRouteOptions {
  usersStore: UsersStore;
  reviewsStore: ReviewsStore;
}

function notFound(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 404 });
}

function findProduct(slug: string) {
  const product = products.find((p) => p.slug === slug);
  if (!product) throw notFound('Product not found');
  return product;
}

const reviewSchema = z.object({
  id: z.string(),
  productSlug: z.string(),
  userId: z.string(),
  userName: z.string(),
  rating: z.number(),
  comment: z.string(),
  createdAt: z.string(),
});

const reviewsListSchema = z.object({
  reviews: z.array(reviewSchema),
  average: z.number(),
  count: z.number().int(),
});

const createReviewBody = z.object({
  rating: z.int().min(1).max(5),
  comment: z.string().trim().min(1).max(2000),
});

const reviewsRoute: FastifyPluginAsyncZod<ReviewsRouteOptions> = async (app, opts) => {
  const { usersStore, reviewsStore } = opts;

  app.get(
    '/api/products/:slug/reviews',
    {
      schema: {
        params: z.object({ slug: z.string() }),
        response: { 200: reviewsListSchema },
      },
    },
    async (req) => {
      findProduct(req.params.slug);

      const reviews = reviewsStore.listByProduct(req.params.slug);
      const aggregate = reviewsStore.getAggregate(req.params.slug);
      return { reviews, ...aggregate };
    },
  );

  app.post(
    '/api/products/:slug/reviews',
    {
      // Runs before the zod body validation, so an unauthenticated request
      // gets 401 even when the body itself is invalid.
      preValidation: async (req) => {
        requireUser(req, usersStore);
      },
      schema: {
        params: z.object({ slug: z.string() }),
        body: createReviewBody,
        response: { 201: reviewSchema },
      },
    },
    async (req, reply) => {
      const user = requireUser(req, usersStore);
      const product = findProduct(req.params.slug);

      try {
        const review = reviewsStore.addReview({
          productSlug: product.slug,
          userId: user.id,
          userName: user.name,
          rating: req.body.rating,
          comment: req.body.comment,
        });
        return reply.code(201).send(review);
      } catch (err) {
        if (err instanceof ReviewsError) {
          throw Object.assign(new Error(err.message), { statusCode: err.statusCode });
        }
        throw err;
      }
    },
  );
};

export default reviewsRoute;
