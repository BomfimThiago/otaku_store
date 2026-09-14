import Fastify, { type FastifyServerOptions } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import errorsPlugin from './plugins/errors.js';
import healthRoute from './routes/health.js';

export function buildApp(opts: FastifyServerOptions = {}) {
  const app = Fastify({ logger: false, ...opts });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(errorsPlugin);
  app.register(healthRoute);

  return app.withTypeProvider<ZodTypeProvider>();
}

export type App = ReturnType<typeof buildApp>;
