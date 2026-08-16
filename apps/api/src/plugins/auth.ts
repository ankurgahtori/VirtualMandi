import type { FastifyRequest } from 'fastify';
import { getUser, verifyAccessToken } from '../services/auth-service.js';

export type AuthContext = { userId: string; role: 'FARMER' | 'ADMIN'; email: string };

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

export const authenticate = async (request: FastifyRequest) => {
  const value = request.headers.authorization;
  if (!value?.startsWith('Bearer ')) throw new Error('UNAUTHORIZED');
  const token = value.slice(7).trim();
  const claims = verifyAccessToken(token);
  const user = await getUser(claims.userId);
  if (!user || user.disabledAt) throw new Error('UNAUTHORIZED');
  request.auth = { userId: user.id, email: user.email, role: user.role };
};

export const requireAdmin = async (request: FastifyRequest) => {
  await authenticate(request);
  if (request.auth?.role !== 'ADMIN') throw new Error('FORBIDDEN');
};
