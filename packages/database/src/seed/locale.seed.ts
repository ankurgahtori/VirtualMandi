import { prisma } from '../client.js';

const locales = [
  { code: 'en-IN', displayName: 'English' },
  { code: 'hi-IN', displayName: 'हिन्दी' },
];

export const seedLocales = async () => {
  for (const locale of locales) {
    await prisma.locale.upsert({
      where: { code: locale.code },
      update: { displayName: locale.displayName },
      create: locale,
    });
  }
};
