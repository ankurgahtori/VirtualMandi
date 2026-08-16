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

type ImageResolver = (input: {
  imageUrl?: string;
  imageFixtureKey?: string;
}) => Promise<{ id: string } | undefined>;

type IngestionOptions = {
  duplicatePolicy?: DuplicatePolicy;
  imageResolver?: ImageResolver;
};

const findExisting = async (
  tx: Prisma.TransactionClient,
  input: ReturnType<typeof normalizeBlogPostInput>,
) => {
  if (input.sourceItemId) {
    const byItem = await tx.post.findFirst({
      where: { ingestionSource: input.source, ingestionItemId: input.sourceItemId },
      select: { id: true },
    });
    if (byItem) return byItem;
  }
  if (input.canonicalUrl) {
    return tx.post.findFirst({
      where: { ingestionSource: input.source, canonicalUrl: input.canonicalUrl },
      select: { id: true },
    });
  }
  return null;
};

const persist = async (
  tx: Prisma.TransactionClient,
  input: ReturnType<typeof normalizeBlogPostInput>,
  imageResolver?: ImageResolver,
  existingId?: string,
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

  const image = imageResolver
    ? await imageResolver({ imageUrl: input.imageUrl, imageFixtureKey: input.imageFixtureKey })
    : undefined;
  const postData = {
    type: 'BLOG_POST' as const,
    status: 'DRAFT' as const,
    ingestionSource: input.source,
    ingestionItemId: input.sourceItemId,
    canonicalUrl: input.canonicalUrl,
    fetchedAt: input.fetchedAt ? new Date(input.fetchedAt) : undefined,
    crawlerName: input.crawlerName,
    crawlerVersion: input.crawlerVersion,
  };

  const post = existingId
    ? await tx.post.update({ where: { id: existingId }, data: postData })
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
      await prisma.$transaction((tx) => persist(tx, input, options.imageResolver, existing?.id));
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
