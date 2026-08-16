import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import { prisma } from '@virtual-mandi/database';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerAdminPostRoutes } from './routes/admin-posts.js';
import { registerPostRoutes } from './routes/posts.js';

export const buildApp = () => {
  const app = Fastify({ logger: false, requestIdHeader: 'x-request-id' });
  app.register(sensible);
  registerErrorHandler(app);
  app.get('/health', async () => ({ status: 'ok', service: 'virtual-mandi-api' }));
  app.get('/ready', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch {
      return reply.status(503).send({ status: 'not_ready' });
    }
  });
  app.register(registerAuthRoutes);
  app.register(registerPostRoutes);
  app.register(registerAdminPostRoutes);
  return app;
};
