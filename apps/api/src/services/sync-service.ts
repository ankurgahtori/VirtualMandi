import { prisma } from '@virtual-mandi/database';
import {
  createRemoteImageResolver,
  findIngestionSourceByDomain,
  INGESTION_SOURCES,
  ingestBlogPosts,
  type IngestionResult,
} from '@virtual-mandi/ingestion';
import type { IngestionSourceStatusDto, SyncRequestInput } from '@virtual-mandi/shared';

const running = new Set<string>();

export const isSyncing = (domain: string) => running.has(domain);

/**
 * Registry sources joined with per-domain post stats. Posts are grouped by the
 * hostname of `Post.canonicalUrl` — subroutes are intentionally collapsed so a
 * domain like krishijagran.com counts every story it produced.
 */
export const getSourceStatuses = async (): Promise<IngestionSourceStatusDto[]> => {
  const posts = await prisma.post.findMany({
    where: { ingestionSource: 'WEBSITE', canonicalUrl: { not: null } },
    select: { canonicalUrl: true, fetchedAt: true },
  });
  const stats = new Map<string, { postCount: number; lastFetchedAt?: Date }>();
  for (const post of posts) {
    let hostname: string;
    try {
      hostname = new URL(post.canonicalUrl!).hostname;
    } catch {
      continue;
    }
    const entry = stats.get(hostname) ?? { postCount: 0 };
    entry.postCount += 1;
    if (post.fetchedAt && (!entry.lastFetchedAt || post.fetchedAt > entry.lastFetchedAt)) {
      entry.lastFetchedAt = post.fetchedAt;
    }
    stats.set(hostname, entry);
  }
  return INGESTION_SOURCES.map((source) => ({
    domain: source.domain,
    label: source.label,
    postCount: stats.get(source.domain)?.postCount ?? 0,
    lastFetchedAt: stats.get(source.domain)?.lastFetchedAt?.toISOString(),
    syncing: running.has(source.domain),
  }));
};

/**
 * Runs one listing pass for a registered source through the shared ingestion
 * pipeline. Only one sync per domain runs at a time (single-process lock; the
 * admin UI is the fallback trigger when the daily cron misses).
 */
export const syncSource = async (
  domain: string,
  input: SyncRequestInput = {},
): Promise<IngestionResult> => {
  const source = findIngestionSourceByDomain(domain);
  if (!source) throw new Error('NOT_FOUND');
  if (running.has(domain)) throw new Error('SYNC_IN_PROGRESS');

  running.add(domain);
  try {
    const adapter = source.createAdapter({
      after: input.after,
      maxPages: input.pages,
      initialStatus: 'PUBLISHED',
    });
    return await ingestBlogPosts(adapter.collect(), {
      duplicatePolicy: input.update ? 'update' : 'skip',
      imageResolver: createRemoteImageResolver(),
    });
  } finally {
    running.delete(domain);
  }
};
