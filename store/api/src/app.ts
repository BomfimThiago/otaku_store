import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyServerOptions } from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import errorsPlugin from './plugins/errors.js';
import healthRoute from './routes/health.js';
import productsRoute from './routes/products.js';
import cartRoute from './routes/cart.js';
import authRoute from './routes/auth.js';
import reviewsRoute from './routes/reviews.js';
import { createUsersStore } from './data/users.js';
import { createReviewsStore } from './data/reviews.js';

/** The built SPA to serve (present in production; absent in unit tests). */
const SPA_DIST = join(dirname(fileURLToPath(import.meta.url)), '../../web/dist');

export function buildApp(opts: FastifyServerOptions = {}) {
  const app = Fastify({ logger: false, ...opts });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cookie, { secret: process.env.COOKIE_SECRET ?? 'otakuverso-dev-cookie-secret-change-me' });
  // errorsPlugin owns the not-found handler; it serves the SPA index for GET
  // routes outside /api when a build is present, and JSON 404 otherwise.
  app.register(errorsPlugin, { spaDist: SPA_DIST });
  app.register(healthRoute);

  // Built here (rather than at module scope) so each buildApp() gets its own
  // in-memory state, keeping tests isolated from one another.
  const usersStore = createUsersStore();
  const reviewsStore = createReviewsStore();

  app.register(productsRoute, { reviewsStore });
  app.register(cartRoute);
  app.register(authRoute, { usersStore });
  app.register(reviewsRoute, { usersStore, reviewsStore });

  // Hashed JS/CSS assets; SPA routes (/, /p/:slug, /cart, /login, /register, /sobre)
  // fall through to the not-found handler, which returns index.html.
  if (existsSync(join(SPA_DIST, 'assets'))) {
    app.register(fastifyStatic, { root: join(SPA_DIST, 'assets'), prefix: '/assets/' });
  }

  return app.withTypeProvider<ZodTypeProvider>();
}

export type App = ReturnType<typeof buildApp>;
