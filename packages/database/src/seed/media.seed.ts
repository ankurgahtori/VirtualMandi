import { prisma } from '../client.js';
import { getSeedMediaConfig, uploadSeedImage } from '../media/storage.js';
import { seededBlogPost, seedImageSvg } from './fixtures/blog-posts.js';

export const seedMedia = async () => {
  const config = getSeedMediaConfig();
  await uploadSeedImage(seededBlogPost.imageObjectKey, new TextEncoder().encode(seedImageSvg));

  return prisma.mediaAsset.upsert({
    where: { id: seededBlogPost.mediaId },
    update: {
      provider: config.provider,
      bucket: config.bucket,
      objectKey: seededBlogPost.imageObjectKey,
      mimeType: 'image/svg+xml',
    },
    create: {
      id: seededBlogPost.mediaId,
      provider: config.provider,
      bucket: config.bucket,
      objectKey: seededBlogPost.imageObjectKey,
      mimeType: 'image/svg+xml',
    },
  });
};
