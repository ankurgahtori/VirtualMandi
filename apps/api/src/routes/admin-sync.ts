import type { FastifyInstance } from 'fastify';
import { syncRequestSchema } from '@virtual-mandi/shared';
import { requireAdmin } from '../plugins/auth.js';
import { getSourceStatuses, syncSource } from '../services/sync-service.js';

export const registerAdminSyncRoutes = async (app: FastifyInstance) => {
  app.get('/v1/admin/sync/sources', { preHandler: requireAdmin }, async () => ({
    items: await getSourceStatuses(),
  }));

  app.post('/v1/admin/sync/:domain', { preHandler: requireAdmin }, async (request) => {
    const domain = (request.params as { domain: string }).domain;
    const input = syncRequestSchema.parse(request.body ?? {});
    return syncSource(domain, input);
  });
};
