import { createHash, createHmac, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma, type User } from '@virtual-mandi/database';
import type { AuthResponseDto, AuthTokensDto, AuthUserDto } from '@virtual-mandi/shared';
import { config } from '../config.js';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const toUserDto = (user: Pick<User, 'id' | 'email' | 'role'>): AuthUserDto => ({
  id: user.id,
  email: user.email,
  role: user.role,
});

const base64Url = (value: string) => Buffer.from(value).toString('base64url');
export const createAccessToken = (user: Pick<User, 'id' | 'role'>): string => {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      sub: user.id,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + config.ACCESS_TOKEN_TTL_SECONDS,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signature = createHmac('sha256', config.JWT_SECRET).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
};

export const verifyAccessToken = (token: string): { userId: string; role: 'FARMER' | 'ADMIN' } => {
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) throw new Error('Invalid access token');
  const expected = createHmac('sha256', config.JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  if (signature !== expected) throw new Error('Invalid access token');
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
    sub?: string;
    role?: 'FARMER' | 'ADMIN';
    exp?: number;
  };
  if (!decoded.sub || !decoded.role || !decoded.exp || decoded.exp <= Math.floor(Date.now() / 1000))
    throw new Error('Expired access token');
  return { userId: decoded.sub, role: decoded.role };
};

const issueTokens = async (user: User): Promise<AuthTokensDto> => {
  const refreshToken = randomBytes(48).toString('base64url');
  await prisma.refreshSession.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + config.REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
  });
  return {
    accessToken: createAccessToken(user),
    refreshToken,
    tokenType: 'Bearer',
    expiresInSeconds: config.ACCESS_TOKEN_TTL_SECONDS,
  };
};

export const register = async (email: string, password: string): Promise<AuthResponseDto> => {
  const normalizedEmail = normalizeEmail(email);
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const user = await prisma.user.create({ data: { email: normalizedEmail, passwordHash } });
    return { user: toUserDto(user), tokens: await issueTokens(user) };
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') throw new Error('ACCOUNT_ALREADY_EXISTS');
    throw error;
  }
};

export const login = async (email: string, password: string): Promise<AuthResponseDto> => {
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  if (!user || user.disabledAt || !(await bcrypt.compare(password, user.passwordHash)))
    throw new Error('INVALID_CREDENTIALS');
  return { user: toUserDto(user), tokens: await issueTokens(user) };
};

export const refresh = async (refreshToken: string): Promise<AuthResponseDto> => {
  const session = await prisma.refreshSession.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.disabledAt)
    throw new Error('INVALID_REFRESH_TOKEN');
  const nextToken = randomBytes(48).toString('base64url');
  const tokens: AuthTokensDto = {
    accessToken: createAccessToken(session.user),
    refreshToken: nextToken,
    tokenType: 'Bearer',
    expiresInSeconds: config.ACCESS_TOKEN_TTL_SECONDS,
  };
  await prisma.$transaction([
    prisma.refreshSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } }),
    prisma.refreshSession.create({
      data: {
        userId: session.userId,
        tokenHash: hashToken(nextToken),
        expiresAt: new Date(Date.now() + config.REFRESH_TOKEN_TTL_SECONDS * 1000),
      },
    }),
  ]);
  return { user: toUserDto(session.user), tokens };
};

export const logout = async (refreshToken: string): Promise<void> => {
  await prisma.refreshSession.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

export const getUser = (id: string) =>
  prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, disabledAt: true },
  });
