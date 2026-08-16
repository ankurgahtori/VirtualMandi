import bcrypt from 'bcryptjs';
import { prisma } from '../client.js';

export const seedUsers = async () => {
  const passwordHash = await bcrypt.hash('VirtualMandi123!', 10);
  return prisma.user.upsert({
    where: { email: 'admin@virtualmandi.local' },
    update: { passwordHash, role: 'ADMIN', disabledAt: null },
    create: {
      id: 'seed-admin-user',
      email: 'admin@virtualmandi.local',
      passwordHash,
      role: 'ADMIN',
    },
  });
};
