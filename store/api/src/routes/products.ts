import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ReviewsStore } from '../data/reviews.js';
import { productSchema, products } from '../data/products.js';
import type { Product } from '../data/products.js';

const productWithRatingSchema = productSchema.extend({
  ratingAverage: z.number(),
  ratingCount: z.number().int(),
});

export interface ProductsRouteOptions {
  reviewsStore: ReviewsStore;
}

const productsRoute: FastifyPluginAsyncZod<ProductsRouteOptions> = async (app, opts) => {
  const { reviewsStore } = opts;

  function withRating(product: Product) {
    const { average, count } = reviewsStore.getAggregate(product.slug);
    return { ...product, ratingAverage: average, ratingCount: count };
  }

  app.get(
    '/api/products',
    {
      schema: {
        querystring: z.object({
          category: z.string().optional(),
          q: z.string().optional(),
        }),
        response: {
          200: z.array(productWithRatingSchema),
        },
      },
    },
    async (req) => {
      const category = req.query.category?.trim();
      const q = req.query.q?.trim().toLowerCase();

      return products
        .filter((product) => {
          if (category && product.category !== category) {
            return false;
          }

          if (q && !product.name.toLowerCase().includes(q) && !product.description.toLowerCase().includes(q)) {
            return false;
          }

          return true;
        })
        .map(withRating);
    },
  );

  app.get(
    '/api/products/:slug',
    {
      schema: {
        params: z.object({ slug: z.string() }),
        response: {
          200: productWithRatingSchema,
        },
      },
    },
    async (req) => {
      const product = products.find((p) => p.slug === req.params.slug);

      if (!product) {
        throw Object.assign(new Error('Product not found'), { statusCode: 404 });
      }

      return withRating(product);
    },
  );
};

export default productsRoute;
