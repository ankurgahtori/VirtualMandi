import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  blogPostCreateSchema,
  blogPostUpdateSchema,
  postListQuerySchema,
} from '@virtual-mandi/shared';
import { requireAdmin } from '../plugins/auth.js';
import { ConfiguredMediaStorage } from '../services/media-service.js';
import {
  changeStatus,
  createBlogPost,
  getAdminPosts,
  restorePost,
  updateBlogPost,
} from '../services/post-service.js';

export const registerAdminPostRoutes = async (app: FastifyInstance) => {
  const mediaStorage = new ConfiguredMediaStorage();
  app.post('/v1/admin/media/upload-url', { preHandler: requireAdmin }, async (request, reply) => {
    const input = z
      .object({
        objectKey: z.string().trim().min(1).max(500),
        mimeType: z.string().trim().min(1).max(100),
      })
      .parse(request.body);
    return reply.send(await mediaStorage.createUploadUrl(input));
  });
  app.get('/v1/admin/posts', { preHandler: requireAdmin }, async (request) => {
    const query = postListQuerySchema.parse(request.query);
    return {
      items: await getAdminPosts({
        ...(query.status ? { status: query.status } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.source ? { ingestionSource: query.source } : {}),
      }),
    };
  });
  app.post('/v1/admin/posts', { preHandler: requireAdmin }, async (request, reply) => {
    const input = blogPostCreateSchema.parse(request.body);
    return reply.status(201).send(await createBlogPost(input, request.auth!.userId));
  });
  app.patch('/v1/admin/posts/:id', { preHandler: requireAdmin }, async (request) => {
    const input = blogPostUpdateSchema.parse(request.body);
    return updateBlogPost((request.params as { id: string }).id, input, request.auth!.userId);
  });
  const transition =
    (status: 'PUBLISHED' | 'ARCHIVED' | 'DRAFT' | 'REMOVED') => async (request: FastifyRequest) => {
      const id = (request.params as { id: string }).id;
      if (status === 'PUBLISHED') {
        const post = await (await import('../services/post-service.js')).getPost(id, 'en-IN', true);
        if (
          !post ||
          !post.translations?.some(
            (translation) =>
              translation.locale.toLowerCase() === 'en-in' &&
              translation.title.length > 0 &&
              translation.content.length > 0,
          )
        ) {
          throw new Error('PUBLISH_REQUIRES_ENGLISH');
        }
      }
      return changeStatus(id, status, request.auth!.userId);
    };
  app.post('/v1/admin/posts/:id/publish', { preHandler: requireAdmin }, transition('PUBLISHED'));
  app.post('/v1/admin/posts/:id/archive', { preHandler: requireAdmin }, transition('ARCHIVED'));
  app.post('/v1/admin/posts/:id/restore', { preHandler: requireAdmin }, async (request) =>
    restorePost((request.params as { id: string }).id, request.auth!.userId),
  );
  app.post('/v1/admin/posts/:id/remove', { preHandler: requireAdmin }, transition('REMOVED'));
};
