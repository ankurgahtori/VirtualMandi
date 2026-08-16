import { prisma } from '../client.js';

export const seedLocations = async () => {
  await prisma.location.upsert({
    where: { key: 'india' },
    update: { name: 'India', level: 'COUNTRY', parentId: null },
    create: { id: 'seed-location-india', key: 'india', name: 'India', level: 'COUNTRY' },
  });
};
