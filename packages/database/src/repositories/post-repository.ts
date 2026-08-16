import { Prisma, type PostStatus, type PostType } from '../generated/client.js';
import { prisma } from '../client.js';

export type PublishedPostFilters = {
  locale: string;
  locationId?: string;
  categoryId?: string;
  cursor?: string;
  limit?: number;
};

const translationInclude = (locale: string) => ({
  where: { locale: { code: { in: [locale, 'en-IN'] } } },
  include: { locale: true },
});

export const findPublishedPosts = async (filters: PublishedPostFilters) => {
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 50);
  const posts = await prisma.post.findMany({
    where: {
      status: 'PUBLISHED',
      removedAt: null,
      type: 'BLOG_POST',
      ...(filters.locationId ? { locations: { some: { locationId: filters.locationId } } } : {}),
      ...(filters.categoryId ? { categories: { some: { categoryId: filters.categoryId } } } : {}),
    },
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    take: limit + 1,
    include: {
      blogPost: {
        include: {
          imageMedia: true,
          translations: translationInclude(filters.locale),
        },
      },
      categories: true,
      locations: true,
    },
  });

  const hasNextPage = posts.length > limit;
  const items = hasNextPage ? posts.slice(0, limit) : posts;
  return { items, nextCursor: hasNextPage ? items.at(-1)?.id : undefined, hasNextPage };
};

export const findPostById = (id: string) =>
  prisma.post.findUnique({
    where: { id },
    include: {
      blogPost: {
        include: {
          imageMedia: true,
          translations: { include: { locale: true } },
        },
      },
      categories: { include: { category: true } },
      locations: { include: { location: true } },
    },
  });

export const findAdminPosts = (where: Prisma.PostWhereInput = {}) =>
  prisma.post.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: {
      blogPost: {
        include: { imageMedia: true, translations: { include: { locale: true } } },
      },
      categories: { include: { category: true } },
      locations: { include: { location: true } },
    },
  });

export const transitionPostStatus = async (id: string, status: PostStatus, updatedById?: string) =>
  prisma.post.update({
    where: { id },
    data: {
      status,
      updatedById,
      publishedAt: status === 'PUBLISHED' ? new Date() : undefined,
      archivedAt: status === 'ARCHIVED' ? new Date() : undefined,
      removedAt: status === 'REMOVED' ? new Date() : status === 'PUBLISHED' ? null : undefined,
    },
  });

export const countPostsByType = (type: PostType) => prisma.post.count({ where: { type } });
