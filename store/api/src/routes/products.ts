import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { productSchema, products } from '../data/products.js';

const productsRoute: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/api/products',
    {
      schema: {
        querystring: z.object({
          category: z.string().optional(),
          q: z.string().optional(),
        }),
        response: {
          200: z.array(productSchema),
        },
      },
    },
    async (req) => {
      const category = req.query.category?.trim();
      const q = req.query.q?.trim().toLowerCase();

      return products.filter((product) => {
        if (category && product.category !== category) {
          return false;
        }

        if (q && !product.name.toLowerCase().includes(q) && !product.description.toLowerCase().includes(q)) {
          return false;
        }

        return true;
      });
    },
  );

  app.get(
    '/api/products/:slug',
    {
      schema: {
        params: z.object({ slug: z.string() }),
        response: {
          200: productSchema,
        },
      },
    },
    async (req) => {
      const product = products.find((p) => p.slug === req.params.slug);

      if (!product) {
        throw Object.assign(new Error('Product not found'), { statusCode: 404 });
      }

      return product;
    },
  );
};

export default productsRoute;
