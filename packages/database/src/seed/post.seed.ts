import { prisma } from '../client.js';
import { seededBlogPost } from './fixtures/blog-posts.js';

export const seedPost = async (adminId: string) =>
  prisma.post.upsert({
    where: { id: seededBlogPost.postId },
    update: {
      type: 'BLOG_POST',
      status: 'PUBLISHED',
      publishedAt: new Date('2025-01-01T00:00:00.000Z'),
      createdById: adminId,
      updatedById: adminId,
      ingestionSource: seededBlogPost.source,
      ingestionItemId: seededBlogPost.sourceItemId,
      canonicalUrl: seededBlogPost.canonicalUrl,
    },
    create: {
      id: seededBlogPost.postId,
      type: 'BLOG_POST',
      status: 'PUBLISHED',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      publishedAt: new Date('2025-01-01T00:00:00.000Z'),
      createdById: adminId,
      updatedById: adminId,
      ingestionSource: seededBlogPost.source,
      ingestionItemId: seededBlogPost.sourceItemId,
      canonicalUrl: seededBlogPost.canonicalUrl,
      fetchedAt: new Date('2025-01-01T00:00:00.000Z'),
      crawlerName: 'seed-fixture',
      crawlerVersion: '1.0.0',
    },
  });
