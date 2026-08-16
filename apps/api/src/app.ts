import cors from '@fastify/cors';
import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import { prisma } from '@virtual-mandi/database';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerAdminPostRoutes } from './routes/admin-posts.js';
import { checkMediaStorage } from './services/media-service.js';
import { config } from './config.js';
import { registerPostRoutes } from './routes/posts.js';

export const buildApp = () => {
  const app = Fastify({
    logger: { level: config.NODE_ENV === 'development' ? 'info' : 'warn' },
    requestIdHeader: 'x-request-id',
  });
  app.register(sensible);
  app.register(cors, { origin: config.NODE_ENV === 'development' ? true : config.corsOrigins });
  registerErrorHandler(app);
  app.get('/health', async () => ({ status: 'ok', service: 'virtual-mandi-api' }));
  app.get('/ready', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await checkMediaStorage();
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
