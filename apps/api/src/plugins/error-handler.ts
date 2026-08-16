import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

export const registerErrorHandler = (app: FastifyInstance) => {
  app.setErrorHandler((error, request, reply) => {
    const requestId = request.id;
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          requestId,
          fields: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        },
      });
    }
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR';
    const known: Record<string, { status: number; message: string }> = {
      UNAUTHORIZED: { status: 401, message: 'Authentication required' },
      FORBIDDEN: { status: 403, message: 'Administrator access required' },
      INVALID_CREDENTIALS: { status: 401, message: 'Invalid email or password' },
      INVALID_REFRESH_TOKEN: { status: 401, message: 'Invalid refresh token' },
      ACCOUNT_ALREADY_EXISTS: {
        status: 409,
        message: 'Unable to create account with those details',
      },
      CATEGORY_NOT_FOUND: { status: 400, message: 'One or more categories were not found' },
      LOCATION_NOT_FOUND: { status: 400, message: 'One or more locations were not found' },
      PUBLISH_REQUIRES_ENGLISH: {
        status: 400,
        message: 'An English translation is required before publishing',
      },
      VALIDATION_ERROR: { status: 400, message: 'Request validation failed' },
      NOT_FOUND: { status: 404, message: 'Resource not found' },
      INVALID_LIFECYCLE_TRANSITION: { status: 409, message: 'Invalid post lifecycle transition' },
      RATE_LIMITED: { status: 429, message: 'Too many authentication requests' },
    };
    const mapped = known[code] ?? { status: 500, message: 'Internal server error' };
    if (mapped.status === 500) request.log.error({ err: error, requestId }, 'request failed');
    return reply
      .status(mapped.status)
      .send({ error: { code, message: mapped.message, requestId } });
  });
};
