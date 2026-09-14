import { STATUS_CODES } from 'node:http';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from 'fastify-type-provider-zod';

function isClientError(error: FastifyError): error is FastifyError & { statusCode: number } {
  return typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500;
}

export default fp(async (app) => {
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: 'Not Found',
      message: `Route ${request.method}:${request.url} not found`,
      statusCode: 404,
    });
  });

  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      reply.status(400).send({
        error: 'Bad Request',
        message: 'Validation failed',
        statusCode: 400,
        details: error.validation.map((issue) => ({
          path: issue.instancePath,
          code: issue.keyword,
          message: issue.message,
        })),
      });
      return;
    }

    if (isResponseSerializationError(error)) {
      reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Response did not match schema',
        statusCode: 500,
      });
      return;
    }

    if (isClientError(error)) {
      reply.status(error.statusCode).send({
        error: STATUS_CODES[error.statusCode] ?? 'Error',
        message: error.message,
        statusCode: error.statusCode,
      });
      return;
    }

    request.log.error(error);
    reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      statusCode: 500,
    });
  });
});
