import type { FastifyRequest } from 'fastify';

const windows = new Map<string, { startedAt: number; count: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

export const authRateLimit = async (request: FastifyRequest) => {
  const key = request.ip;
  const now = Date.now();
  const current = windows.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    windows.set(key, { startedAt: now, count: 1 });
    return;
  }
  current.count += 1;
  if (current.count > MAX_REQUESTS) throw new Error('RATE_LIMITED');
};
