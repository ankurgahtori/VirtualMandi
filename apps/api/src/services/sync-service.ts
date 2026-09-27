import { prisma, type Prisma } from '@virtual-mandi/database';
import {
  createRemoteImageResolver,
  findIngestionAdapter,
  INGESTION_ADAPTERS,
  ingestBlogPosts,
  type IngestionResult,
} from '@virtual-mandi/ingestion';
import type {
  SyncRequestInput,
  SyncSourceCategoryCreateInput,
  SyncSourceCreateInput,
  SyncSourcesResponseDto,
} from '@virtual-mandi/shared';

const running = new Set<string>();

export const isSyncing = (categoryId: string) => running.has(categoryId);

/**
 * SyncSource rows joined with per-category post stats. Counts and last-fetched
 * come from `Post.syncSourceCategoryId` — no canonicalUrl parsing needed.
 */
export const getSyncOverview = async (): Promise<SyncSourcesResponseDto> => {
  const [sources, stats, feedCategories, locations] = await Promise.all([
    prisma.syncSource.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        categories: {
          orderBy: { createdAt: 'asc' },
          include: { feedCategory: true, location: true },
        },
      },
    }),
    prisma.post.groupBy({
      by: ['syncSourceCategoryId'],
      where: { syncSourceCategoryId: { not: null } },
      _count: { _all: true },
      _max: { fetchedAt: true },
    }),
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
    prisma.location.findMany({ orderBy: { name: 'asc' } }),
  ]);
  const statsByCategory = new Map(stats.map((stat) => [stat.syncSourceCategoryId, stat]));
  return {
    items: sources.map((source) => ({
      id: source.id,
      domain: source.domain,
      label: source.label,
      adapterKey: source.adapterKey,
      isActive: source.isActive,
      categories: source.categories.map((category) => {
        const stat = statsByCategory.get(category.id);
        return {
          id: category.id,
          label: category.label,
          listingUrl: category.listingUrl,
          categoryKey: category.feedCategory?.key ?? undefined,
          categoryName: category.feedCategory?.name ?? undefined,
          locationKey: category.location?.key ?? undefined,
          postCount: stat?._count._all ?? 0,
          lastFetchedAt: stat?._max.fetchedAt?.toISOString(),
          lastSyncedAt: category.lastSyncedAt?.toISOString(),
          syncing: running.has(category.id),
        };
      }),
    })),
    adapters: INGESTION_ADAPTERS.map((adapter) => ({ key: adapter.key, label: adapter.label })),
    feedCategories: feedCategories.map((category) => ({
      id: category.id,
      key: category.key,
      name: category.name,
    })),
    locations: locations.map((location) => ({
      id: location.id,
      key: location.key,
      name: location.name,
    })),
  };
};

export const createSyncSource = async (input: SyncSourceCreateInput) => {
  if (!findIngestionAdapter(input.adapterKey)) throw new Error('UNKNOWN_ADAPTER');
  const domain = input.domain.toLowerCase();
  if (await prisma.syncSource.findUnique({ where: { domain } })) {
    throw new Error('SYNC_SOURCE_EXISTS');
  }
  return prisma.syncSource.create({
    data: { domain, label: input.label, adapterKey: input.adapterKey },
  });
};

export const createSyncCategory = async (input: SyncSourceCategoryCreateInput) => {
  const source = await prisma.syncSource.findUnique({ where: { id: input.syncSourceId } });
  if (!source || !source.isActive) throw new Error('NOT_FOUND');
  if (new URL(input.listingUrl).hostname !== source.domain) {
    throw new Error('LISTING_DOMAIN_MISMATCH');
  }
  if (
    input.categoryId &&
    !(await prisma.category.findUnique({ where: { id: input.categoryId } }))
  ) {
    throw new Error('CATEGORY_NOT_FOUND');
  }
  if (
    input.locationId &&
    !(await prisma.location.findUnique({ where: { id: input.locationId } }))
  ) {
    throw new Error('LOCATION_NOT_FOUND');
  }
  const duplicate = await prisma.syncSourceCategory.findUnique({
    where: { syncSourceId_listingUrl: { syncSourceId: source.id, listingUrl: input.listingUrl } },
  });
  if (duplicate) throw new Error('SYNC_CATEGORY_EXISTS');
  return prisma.syncSourceCategory.create({
    data: {
      syncSourceId: source.id,
      label: input.label,
      listingUrl: input.listingUrl,
      categoryId: input.categoryId,
      locationId: input.locationId,
      adapterConfig: input.adapterConfig as Prisma.InputJsonValue | undefined,
    },
  });
};

/**
 * Runs one listing pass for a sync source category through the shared
 * ingestion pipeline. Only one sync per category runs at a time
 * (single-process lock); posts are stamped with the source/category so the
 * sync page can report per-URL stats without URL parsing.
 */
export const syncCategory = async (
  categoryId: string,
  input: SyncRequestInput = {},
): Promise<IngestionResult> => {
  const category = await prisma.syncSourceCategory.findUnique({
    where: { id: categoryId },
    include: { syncSource: true, feedCategory: true, location: true },
  });
  if (!category || !category.isActive || !category.syncSource.isActive) {
    throw new Error('NOT_FOUND');
  }
  const adapterDef = findIngestionAdapter(category.syncSource.adapterKey);
  if (!adapterDef) throw new Error('UNKNOWN_ADAPTER');
  if (running.has(category.id)) throw new Error('SYNC_IN_PROGRESS');

  running.add(category.id);
  try {
    const adapter = adapterDef.createAdapter({
      listingUrl: category.listingUrl,
      adapterConfig: category.adapterConfig as Record<string, unknown> | undefined,
      categoryKeys: category.feedCategory ? [category.feedCategory.key] : undefined,
      locationKeys: category.location ? [category.location.key] : undefined,
      after: input.after,
      maxPages: input.pages,
      initialStatus: 'PUBLISHED',
    });
    const result = await ingestBlogPosts(adapter.collect(), {
      duplicatePolicy: input.update ? 'update' : 'skip',
      imageResolver: createRemoteImageResolver(),
      attribution: {
        syncSourceId: category.syncSourceId,
        syncSourceCategoryId: category.id,
      },
    });
    await prisma.syncSourceCategory.update({
      where: { id: category.id },
      data: { lastSyncedAt: new Date() },
    });
    return result;
  } finally {
    running.delete(category.id);
  }
};
