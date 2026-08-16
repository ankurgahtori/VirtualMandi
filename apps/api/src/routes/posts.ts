import type { FastifyInstance } from 'fastify';
import { feedQuerySchema } from '@virtual-mandi/shared';
import { getFeed, getPost } from '../services/post-service.js';

export const registerPostRoutes = async (app: FastifyInstance) => {
  app.get('/v1/feed/posts', async (request) => getFeed(feedQuerySchema.parse(request.query)));
  app.get('/v1/posts/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const query = request.query as { locale?: string };
    const post = await getPost(params.id, query.locale);
    if (!post)
      return reply
        .status(404)
        .send({ error: { code: 'NOT_FOUND', message: 'Post not found', requestId: request.id } });
    return post;
  });
};
