import type { FastifyInstance } from 'fastify';
import { authUserSchema, loginSchema, refreshSchema, registerSchema } from '@virtual-mandi/shared';
import { authenticate } from '../plugins/auth.js';
import { authRateLimit } from '../plugins/rate-limit.js';
import { getUser, login, logout, refresh, register } from '../services/auth-service.js';

export const registerAuthRoutes = async (app: FastifyInstance) => {
  app.post('/v1/auth/register', { preHandler: authRateLimit }, async (request, reply) => {
    const input = registerSchema.parse(request.body);
    return reply.status(201).send(await register(input.email, input.password));
  });
  app.post('/v1/auth/login', { preHandler: authRateLimit }, async (request) => {
    const input = loginSchema.parse(request.body);
    return login(input.email, input.password);
  });
  app.post('/v1/auth/refresh', { preHandler: authRateLimit }, async (request) => {
    const input = refreshSchema.parse(request.body);
    return refresh(input.refreshToken);
  });
  app.post('/v1/auth/logout', { preHandler: authenticate }, async (request, reply) => {
    const input = refreshSchema.safeParse(request.body);
    if (input.success) await logout(input.data.refreshToken);
    return reply.status(204).send();
  });
  app.get('/v1/me', { preHandler: authenticate }, async (request) => {
    const user = await getUser(request.auth!.userId);
    return { user: authUserSchema.parse({ id: user!.id, email: user!.email, role: user!.role }) };
  });
};
