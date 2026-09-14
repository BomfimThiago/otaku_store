import Fastify, { type FastifyServerOptions } from 'fastify';

export function buildApp(opts: FastifyServerOptions = {}) {
  const app = Fastify({ logger: false, ...opts });

  return app;
}
