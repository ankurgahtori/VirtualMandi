import type { FastifyInstance } from 'fastify';
import {
  syncRequestSchema,
  syncSourceCategoryCreateSchema,
  syncSourceCreateSchema,
} from '@virtual-mandi/shared';
import { requireAdmin } from '../plugins/auth.js';
import {
  createSyncCategory,
  createSyncSource,
  getSyncOverview,
  syncCategory,
} from '../services/sync-service.js';

export const registerAdminSyncRoutes = async (app: FastifyInstance) => {
  app.get('/v1/admin/sync/sources', { preHandler: requireAdmin }, async () => getSyncOverview());

  app.post('/v1/admin/sync/sources', { preHandler: requireAdmin }, async (request, reply) => {
    const input = syncSourceCreateSchema.parse(request.body ?? {});
    return reply.status(201).send(await createSyncSource(input));
  });

  app.post('/v1/admin/sync/categories', { preHandler: requireAdmin }, async (request, reply) => {
    const input = syncSourceCategoryCreateSchema.parse(request.body ?? {});
    return reply.status(201).send(await createSyncCategory(input));
  });

  app.post('/v1/admin/sync/categories/:id/sync', { preHandler: requireAdmin }, async (request) => {
    const input = syncRequestSchema.parse(request.body ?? {});
    return syncCategory((request.params as { id: string }).id, input);
  });
};
