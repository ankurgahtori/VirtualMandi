import { prisma } from '../client.js';

export const seedCategories = async () => {
  await prisma.category.upsert({
    where: { key: 'market-prices' },
    update: { name: 'Market prices' },
    create: { id: 'seed-category-market-prices', key: 'market-prices', name: 'Market prices' },
  });
};
