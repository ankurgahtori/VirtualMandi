import { prisma, type Prisma } from '@virtual-mandi/database';
import { normalizeBlogPostInput } from './normalize.js';

export type DuplicatePolicy = 'skip' | 'update';

export type IngestionResult = {
  accepted: number;
  created: number;
  updated: number;
  duplicate: number;
  rejected: number;
  errors: Array<{ index: number; message: string }>;
};

export type ImageResolver = (input: {
  imageUrl?: string;
  imageFixtureKey?: string;
  sourceItemId?: string;
}) => Promise<{ id: string } | undefined>;

export type SyncAttribution = {
  syncSourceId?: string;
  syncSourceCategoryId?: string;
};

type IngestionOptions = {
  duplicatePolicy?: DuplicatePolicy;
  imageResolver?: ImageResolver;
  /** Stamps Post.syncSourceId/syncSourceCategoryId on every item in the run. */
  attribution?: SyncAttribution;
};

/**
 * Resolves the SyncSource (by canonicalUrl hostname) and SyncSourceCategory
 * (longest listingUrl path-prefix match) for a post. Sources are loaded once
 * per ingestion run so CLI jobs attribute posts without explicit options.
 */
const createAttributionResolver = () => {
  let sources:
    | Array<{
        id: string;
        domain: string;
        categories: Array<{ id: string; listingUrl: string }>;
      }>
    | undefined;
  return async (canonicalUrl?: string): Promise<SyncAttribution> => {
    if (!canonicalUrl) return {};
    let url: URL;
    try {
      url = new URL(canonicalUrl);
    } catch {
      return {};
    }
    sources ??= await prisma.syncSource.findMany({
      select: {
        id: true,
        domain: true,
        categories: {
          where: { isActive: true },
          select: { id: true, listingUrl: true },
        },
      },
    });
    const source = sources.find((entry) => entry.domain === url.hostname);
    if (!source) return {};
    const category = source.categories
      .map((entry) => {
        try {
          return { id: entry.id, base: new URL(entry.listingUrl).pathname.replace(/\/+$/, '') };
        } catch {
          return undefined;
        }
      })
      .filter((entry): entry is { id: string; base: string } => entry !== undefined)
      .sort((a, b) => b.base.length - a.base.length)
      .find((entry) => url.pathname === entry.base || url.pathname.startsWith(`${entry.base}/`));
    return { syncSourceId: source.id, syncSourceCategoryId: category?.id };
  };
};

const findExisting = async (
  tx: Prisma.TransactionClient,
  input: ReturnType<typeof normalizeBlogPostInput>,
) => {
  if (input.sourceItemId) {
    const byItem = await tx.post.findFirst({
      where: { ingestionSource: input.source, ingestionItemId: input.sourceItemId },
      select: { id: true, summaryGenerated: true },
    });
    if (byItem) return byItem;
  }
  if (input.canonicalUrl) {
    return tx.post.findFirst({
      where: { ingestionSource: input.source, canonicalUrl: input.canonicalUrl },
      select: { id: true, summaryGenerated: true },
    });
  }
  return null;
};

const persist = async (
  tx: Prisma.TransactionClient,
  input: ReturnType<typeof normalizeBlogPostInput>,
  image: { id: string } | undefined,
  existing?: { id: string; summaryGenerated: boolean },
  attribution?: SyncAttribution,
) => {
  const locales = await Promise.all(
    input.translations.map((translation) =>
      tx.locale.findUniqueOrThrow({
        where: { code: translation.locale },
        select: { id: true, code: true },
      }),
    ),
  );
  const categories = await tx.category.findMany({
    where: { key: { in: input.categoryKeys } },
    select: { id: true, key: true },
  });
  const locations = await tx.location.findMany({
    where: { key: { in: input.locationKeys } },
    select: { id: true, key: true },
  });
  if (categories.length !== input.categoryKeys.length)
    throw new Error('One or more category keys do not exist');
  if (locations.length !== input.locationKeys.length)
    throw new Error('One or more location keys do not exist');
  const postData = {
    type: 'BLOG_POST' as const,
    status: input.initialStatus,
    publishedAt: input.initialStatus === 'PUBLISHED' ? new Date() : null,
    ingestionSource: input.source,
    ingestionItemId: input.sourceItemId,
    canonicalUrl: input.canonicalUrl,
    fetchedAt: input.fetchedAt ? new Date(input.fetchedAt) : undefined,
    crawlerName: input.crawlerName,
    crawlerVersion: input.crawlerVersion,
    ...(attribution?.syncSourceId ? { syncSourceId: attribution.syncSourceId } : {}),
    ...(attribution?.syncSourceCategoryId
      ? { syncSourceCategoryId: attribution.syncSourceCategoryId }
      : {}),
    // A generated summary wins over the crawler's excerpt on re-ingestion.
    ...(existing?.summaryGenerated ? {} : { summary: input.summary ?? null }),
  };

  const post = existing
    ? await tx.post.update({ where: { id: existing.id }, data: postData })
    : await tx.post.create({ data: postData });

  const blogPost = await tx.blogPost.upsert({
    where: { postId: post.id },
    update: {
      source: input.source,
      ...(image ? { imageMediaId: image.id } : {}),
      externalRedirectUrl: input.externalRedirectUrl,
      translations: {
        deleteMany: {},
        create: locales.map((locale, index) => ({
          localeId: locale.id,
          title: input.translations[index].title,
          content: input.translations[index].content,
        })),
      },
    },
    create: {
      postId: post.id,
      source: input.source,
      imageMediaId: image?.id,
      externalRedirectUrl: input.externalRedirectUrl,
      translations: {
        create: locales.map((locale, index) => ({
          localeId: locale.id,
          title: input.translations[index].title,
          content: input.translations[index].content,
        })),
      },
    },
  });

  await tx.postCategory.deleteMany({ where: { postId: post.id } });
  await tx.postLocation.deleteMany({ where: { postId: post.id } });
  await tx.postCategory.createMany({
    data: categories.map(({ id }) => ({ postId: post.id, categoryId: id })),
  });
  await tx.postLocation.createMany({
    data: locations.map(({ id }) => ({ postId: post.id, locationId: id })),
  });
  return { post, blogPost };
};

export const ingestBlogPosts = async (
  inputs: Iterable<unknown> | AsyncIterable<unknown>,
  options: IngestionOptions = {},
): Promise<IngestionResult> => {
  const result: IngestionResult = {
    accepted: 0,
    created: 0,
    updated: 0,
    duplicate: 0,
    rejected: 0,
    errors: [],
  };
  const resolveAttribution = options.attribution
    ? () => Promise.resolve(options.attribution)
    : createAttributionResolver();
  let index = 0;
  for await (const raw of inputs) {
    try {
      const input = normalizeBlogPostInput(raw);
      result.accepted += 1;
      const existing = await findExisting(prisma, input);
      if (existing && (options.duplicatePolicy ?? 'skip') === 'skip') {
        result.duplicate += 1;
        index += 1;
        continue;
      }
      const attribution = await resolveAttribution(input.canonicalUrl);
      // Resolve the image (remote fetch + S3 upload) outside the transaction —
      // network latency would otherwise blow the interactive-tx timeout.
      const image = options.imageResolver
        ? await options.imageResolver({
            imageUrl: input.imageUrl,
            imageFixtureKey: input.imageFixtureKey,
            sourceItemId: input.sourceItemId,
          })
        : undefined;
      await prisma.$transaction(
        (tx) => persist(tx, input, image, existing ?? undefined, attribution),
        { timeout: 15000 },
      );
      if (existing) result.updated += 1;
      else result.created += 1;
    } catch (error) {
      result.rejected += 1;
      result.errors.push({
        index,
        message: error instanceof Error ? error.message : 'Ingestion failed',
      });
    }
    index += 1;
  }
  return result;
};
