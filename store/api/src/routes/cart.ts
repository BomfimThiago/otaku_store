import { randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createCartStore, CartItemNotFoundError } from '../data/cart.js';
import { products } from '../data/products.js';

/** Flat shipping for the MVP (integer cents). */
const SHIPPING_CENTS = 1990;

const cartStore = createCartStore();

function cartId(req: FastifyRequest, reply: FastifyReply): string {
  const existing = req.cookies?.cartId;
  if (existing) return existing;
  const id = randomUUID();
  reply.setCookie('cartId', id, { path: '/', httpOnly: true, sameSite: 'lax' });
  return id;
}

const cartItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  variantId: z.string().nullable(),
  slug: z.string(),
  name: z.string(),
  unitPriceCents: z.number(),
  quantity: z.number(),
  lineTotalCents: z.number(),
});

const cartSchema = z.object({
  id: z.string(),
  items: z.array(cartItemSchema),
  subtotalCents: z.number(),
  discountCents: z.number(),
  totalCents: z.number(),
});

/** Build the enriched cart view the web client expects (money in integer cents). */
function view(id: string) {
  const cart = cartStore.get(id);
  const items = cart.items.flatMap((it) => {
    const product = products.find((p) => p.id === it.productId);
    if (!product) return [];
    const unitPriceCents = product.priceCents;
    return [
      {
        id: it.id,
        productId: it.productId,
        variantId: it.variantId,
        slug: product.slug,
        name: product.name,
        unitPriceCents,
        quantity: it.quantity,
        lineTotalCents: unitPriceCents * it.quantity,
      },
    ];
  });
  const subtotalCents = items.reduce((sum, i) => sum + i.lineTotalCents, 0);
  const totalCents = subtotalCents === 0 ? 0 : subtotalCents + SHIPPING_CENTS;
  return { id, items, subtotalCents, discountCents: 0, totalCents };
}

function notFound(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 404 });
}

const cartRoute: FastifyPluginAsyncZod = async (app) => {
  app.get('/api/cart', { schema: { response: { 200: cartSchema } } }, async (req, reply) =>
    view(cartId(req, reply)),
  );

  app.post(
    '/api/cart',
    {
      schema: {
        body: z.object({
          productId: z.string(),
          variantId: z.string().optional(),
          quantity: z.number().int().positive(),
        }),
        response: { 200: cartSchema },
      },
    },
    async (req, reply) => {
      const id = cartId(req, reply);
      if (!products.some((p) => p.id === req.body.productId)) throw notFound('Product not found');
      cartStore.add(id, {
        productId: req.body.productId,
        variantId: req.body.variantId ?? null,
        quantity: req.body.quantity,
      });
      return view(id);
    },
  );

  app.patch(
    '/api/cart/:itemId',
    {
      schema: {
        params: z.object({ itemId: z.string() }),
        body: z.object({ quantity: z.number().int().positive() }),
        response: { 200: cartSchema },
      },
    },
    async (req, reply) => {
      const id = cartId(req, reply);
      try {
        cartStore.updateQty(id, req.params.itemId, req.body.quantity);
      } catch (err) {
        if (err instanceof CartItemNotFoundError) throw notFound(err.message);
        throw err;
      }
      return view(id);
    },
  );

  app.delete(
    '/api/cart/:itemId',
    { schema: { params: z.object({ itemId: z.string() }) } },
    async (req, reply) => {
      const id = cartId(req, reply);
      try {
        cartStore.remove(id, req.params.itemId);
      } catch (err) {
        if (err instanceof CartItemNotFoundError) throw notFound(err.message);
        throw err;
      }
      return reply.code(204).send();
    },
  );
};

export default cartRoute;
