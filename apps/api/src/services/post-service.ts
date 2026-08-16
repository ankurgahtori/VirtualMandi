import {
  findAdminPosts,
  findPostById,
  findPublishedPosts,
  prisma,
  transitionPostStatus,
  type Prisma,
} from '@virtual-mandi/database';
import {
  normalizeLocale,
  type BlogPostDetailDto,
  type BlogPostCreateInput,
  type BlogPostUpdateInput,
} from '@virtual-mandi/shared';
import { config } from '../config.js';

const mediaDto = (
  media:
    | {
        id: string;
        provider: 'S3' | 'LOCALSTACK_S3';
        mimeType: string;
        objectKey: string;
        width: number | null;
        height: number | null;
        sizeBytes: number | null;
      }
    | null
    | undefined,
) =>
  media
    ? {
        id: media.id,
        provider: media.provider,
        mimeType: media.mimeType,
        objectKey: media.objectKey,
        url: `${config.S3_PUBLIC_BASE_URL ?? ''}/${media.objectKey}`,
        ...(media.width === null ? {} : { width: media.width }),
        ...(media.height === null ? {} : { height: media.height }),
        ...(media.sizeBytes === null ? {} : { sizeBytes: media.sizeBytes }),
      }
    : undefined;

type PostRecord = {
  id: string;
  type: 'BLOG_POST';
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'REMOVED';
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  ingestionItemId: string | null;
  canonicalUrl: string | null;
  fetchedAt: Date | null;
  crawlerName: string | null;
  crawlerVersion: string | null;
  categories: Array<{ categoryId: string }>;
  locations: Array<{ locationId: string }>;
  blogPost: {
    imageMedia: Parameters<typeof mediaDto>[0];
    externalRedirectUrl: string | null;
    source: 'WHATSAPP' | 'WEBSITE' | 'MANUAL';
    translations: Array<{ locale: { code: string }; title: string; content: string }>;
  } | null;
};

const mapPost = (
  post: PostRecord,
  requestedLocale = 'en-IN',
  includeTranslations = false,
): BlogPostDetailDto => {
  if (!post.blogPost) throw new Error('Unsupported post type');
  const requested = normalizeLocale(requestedLocale) ?? 'en-IN';
  const translations = post.blogPost.translations as Array<{
    locale: { code: string };
    title: string;
    content: string;
  }>;
  const selected =
    translations.find((item) => item.locale.code === requested) ??
    translations.find((item) => item.locale.code === 'en-IN');
  if (!selected) throw new Error('Post has no English translation');
  return {
    id: post.id,
    type: post.type,
    status: post.status,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt?.toISOString(),
    publishedAt: post.publishedAt?.toISOString(),
    categoryIds: post.categories.map((item: { categoryId: string }) => item.categoryId),
    locationIds: post.locations.map((item: { locationId: string }) => item.locationId),
    title: selected.title,
    content: selected.content,
    image: mediaDto(post.blogPost.imageMedia),
    externalRedirectUrl: post.blogPost.externalRedirectUrl ?? undefined,
    source: post.blogPost.source,
    requestedLocale: requested,
    resolvedLocale: selected.locale.code,
    isEnglishFallback: selected.locale.code !== requested,
    ...(includeTranslations
      ? {
          translations: translations.map((item) => ({
            locale: item.locale.code,
            title: item.title,
            content: item.content,
          })),
        }
      : {}),
    crawler: {
      sourceItemId: post.ingestionItemId ?? undefined,
      canonicalUrl: post.canonicalUrl ?? undefined,
      fetchedAt: post.fetchedAt?.toISOString(),
      crawlerName: post.crawlerName ?? undefined,
      crawlerVersion: post.crawlerVersion ?? undefined,
    },
  };
};

const relationIds = async (
  tx: Prisma.TransactionClient,
  input: BlogPostCreateInput | BlogPostUpdateInput,
) => {
  const categories = input.categoryIds
    ? await tx.category.findMany({ where: { id: { in: input.categoryIds } }, select: { id: true } })
    : [];
  const locations = input.locationIds
    ? await tx.location.findMany({ where: { id: { in: input.locationIds } }, select: { id: true } })
    : [];
  if (input.categoryIds && categories.length !== input.categoryIds.length)
    throw new Error('CATEGORY_NOT_FOUND');
  if (input.locationIds && locations.length !== input.locationIds.length)
    throw new Error('LOCATION_NOT_FOUND');
  return { categories, locations };
};

export const createBlogPost = async (input: BlogPostCreateInput, userId: string) =>
  prisma.$transaction(async (tx) => {
    const { categories, locations } = await relationIds(tx, input);
    const post = await tx.post.create({
      data: {
        type: 'BLOG_POST',
        createdById: userId,
        updatedById: userId,
        blogPost: {
          create: {
            source: input.source,
            externalRedirectUrl: input.externalRedirectUrl,
            imageMediaId: input.imageMediaId,
            translations: {
              create: input.translations.map((item) => ({
                locale: { connect: { code: normalizeLocale(item.locale) ?? item.locale } },
                title: item.title,
                content: item.content,
              })),
            },
          },
        },
        categories: { create: categories.map(({ id }) => ({ categoryId: id })) },
        locations: { create: locations.map(({ id }) => ({ locationId: id })) },
      },
      include: {
        blogPost: { include: { imageMedia: true, translations: { include: { locale: true } } } },
        categories: true,
        locations: true,
      },
    });
    return mapPost(post, 'en-IN', true);
  });

export const updateBlogPost = async (id: string, input: BlogPostUpdateInput, userId: string) =>
  prisma.$transaction(async (tx) => {
    const { categories, locations } = await relationIds(tx, input);
    const post = await tx.post.update({
      where: { id },
      data: {
        updatedById: userId,
        ...(input.categoryIds
          ? {
              categories: {
                deleteMany: {},
                create: categories.map(({ id: categoryId }) => ({ categoryId })),
              },
            }
          : {}),
        ...(input.locationIds
          ? {
              locations: {
                deleteMany: {},
                create: locations.map(({ id: locationId }) => ({ locationId })),
              },
            }
          : {}),
        blogPost: {
          update: {
            ...(input.source ? { source: input.source } : {}),
            ...(input.externalRedirectUrl !== undefined
              ? { externalRedirectUrl: input.externalRedirectUrl }
              : {}),
            ...(input.imageMediaId !== undefined ? { imageMediaId: input.imageMediaId } : {}),
            ...(input.translations
              ? {
                  translations: {
                    deleteMany: {},
                    create: input.translations.map((item) => ({
                      locale: { connect: { code: normalizeLocale(item.locale) ?? item.locale } },
                      title: item.title,
                      content: item.content,
                    })),
                  },
                }
              : {}),
          },
        },
      },
      include: {
        blogPost: { include: { imageMedia: true, translations: { include: { locale: true } } } },
        categories: true,
        locations: true,
      },
    });
    return mapPost(post, 'en-IN', true);
  });

export const getFeed = async (filters: {
  locale: string;
  locationId?: string;
  categoryId?: string;
  cursor?: string;
  limit: number;
}) => {
  const page = await findPublishedPosts(filters);
  return {
    items: page.items.map((item) => mapPost(item, filters.locale)),
    pageInfo: { nextCursor: page.nextCursor, hasNextPage: page.hasNextPage },
  };
};

export const getPost = async (id: string, locale = 'en-IN', includeUnpublished = false) => {
  const post = await findPostById(id);
  if (!post || (!includeUnpublished && post.status !== 'PUBLISHED')) return undefined;
  return mapPost(post, locale, true);
};

export const getAdminPosts = async (where: Prisma.PostWhereInput = {}) =>
  (await findAdminPosts(where)).map((post) => mapPost(post, 'en-IN', true));
export const changeStatus = async (
  id: string,
  status: 'PUBLISHED' | 'ARCHIVED' | 'DRAFT' | 'REMOVED',
  userId: string,
) => {
  const post = await findPostById(id);
  if (!post) throw new Error('NOT_FOUND');
  const allowed: Record<typeof status, string[]> = {
    PUBLISHED: ['DRAFT'],
    ARCHIVED: ['PUBLISHED'],
    DRAFT: ['ARCHIVED', 'REMOVED'],
    REMOVED: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
  };
  if (!allowed[status].includes(post.status)) throw new Error('INVALID_LIFECYCLE_TRANSITION');
  return transitionPostStatus(id, status, userId);
};
