import type { FastifyInstance } from 'fastify';
import { getMediaObject } from '../services/media-service.js';

const isNotFound = (error: unknown) => {
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    candidate?.name === 'NoSuchKey' ||
    candidate?.name === 'NotFound' ||
    candidate?.$metadata?.httpStatusCode === 404
  );
};

export const registerMediaRoutes = async (app: FastifyInstance) => {
  // Streams stored media through the API so clients only ever need their
  // configured API base URL to reach images (no S3 host on devices).
  app.get('/v1/media/*', async (request, reply) => {
    const objectKey = (request.params as { '*': string })['*'];
    if (!objectKey || objectKey.split('/').includes('..')) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Media not found', requestId: request.id },
      });
    }
    try {
      const object = await getMediaObject(objectKey);
      if (!object.Body) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Media not found', requestId: request.id },
        });
      }
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      if (object.ContentType) reply.type(object.ContentType);
      if (object.ContentLength !== undefined) {
        reply.header('Content-Length', String(object.ContentLength));
      }
      return reply.send(object.Body);
    } catch (error) {
      if (isNotFound(error)) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Media not found', requestId: request.id },
        });
      }
      throw error;
    }
  });
};
