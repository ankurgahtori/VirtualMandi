import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

// Mirror apps/api env loading: shell variables win, repo env files fill gaps.
// Must run before importing ./service.js, which instantiates PrismaClient.
for (const envFile of [
  process.env.ENV_FILE,
  resolve(repositoryRoot, '.env.local'),
  resolve(repositoryRoot, '.env'),
].filter((file): file is string => Boolean(file))) {
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

const readFlagValue = (args: string[], flag: string) => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};

const usage = `Usage: tsx src/sync-cli.ts --adapter-key <key> --listing-url <url> [options]

Collects posts from a listing URL through a registered ingestion adapter (the
same path the admin sync page uses) and ingests them as PUBLISHED blog posts
(pass --draft to keep them unpublished). Safe to run daily: items already
stored under the same source identity are skipped unless --update is passed.
Posts are attributed to the SyncSource/SyncSourceCategory row matching
--listing-url when it exists (exact match, ignoring a trailing slash); other
posts fall back to canonicalUrl resolution.

Options:
  --adapter-key <key>  Required. Adapter key from INGESTION_ADAPTERS
                       (chinimandi, wordpress, krishijagran, businessline,
                       economictimes, livemint, agriculturedive, thehindu)
  --listing-url <url>  Required. Listing page URL, e.g.
                       https://krishijagran.com/commodity-news
  --config '<json>'    Adapter config JSON (e.g. '{"wpCategoryId":14}' for the
                       wordpress key, '{"feedUrl":"..."}' for RSS adapters)
  --after <iso>        Stop at the first post published before this timestamp
  --pages <n>          Listing pages per run where supported (default 1)
  --delay-ms <n>       Delay between requests (default 1000)
  --update             Update existing posts instead of skipping duplicates
  --draft              Ingest as DRAFT instead of the default PUBLISHED
`;

const run = async () => {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage);
    return;
  }
  const numeric = (flag: string) => {
    const raw = readFlagValue(args, flag);
    if (raw === undefined) return undefined;
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`Invalid ${flag}: ${raw}`);
    return value;
  };

  const adapterKey = readFlagValue(args, '--adapter-key');
  const listingUrl = readFlagValue(args, '--listing-url');
  if (!adapterKey || !listingUrl) {
    console.error(usage);
    process.exitCode = 1;
    return;
  }
  const configRaw = readFlagValue(args, '--config');
  const adapterConfig = configRaw ? (JSON.parse(configRaw) as Record<string, unknown>) : undefined;

  const { findIngestionAdapter } = await import('./sources.js');
  const { createRemoteImageResolver } = await import('./image-resolver.js');
  const { ingestBlogPosts } = await import('./service.js');
  const { prisma, disconnectDatabase } = await import('@virtual-mandi/database');

  const definition = findIngestionAdapter(adapterKey);
  if (!definition) throw new Error(`Unknown adapter key: ${adapterKey}`);

  const adapter = definition.createAdapter({
    listingUrl,
    adapterConfig,
    after: readFlagValue(args, '--after'),
    maxPages: numeric('--pages'),
    initialStatus: args.includes('--draft') ? 'DRAFT' : 'PUBLISHED',
  });

  // Resolve the SyncSourceCategory row for the requested listing URL so posts
  // are attributed even when article canonicalUrls don't sit under the
  // listing path (e.g. agriculturedive.com /news/<slug>/<id>/).
  const normalizeListing = (url: string) => url.replace(/\/+$/, '');
  const categoryRow = await prisma.syncSourceCategory.findFirst({
    where: {
      isActive: true,
      syncSource: { domain: new URL(listingUrl).hostname },
      listingUrl: {
        in: [listingUrl, normalizeListing(listingUrl), `${normalizeListing(listingUrl)}/`],
      },
    },
    select: { id: true, syncSourceId: true },
  });

  try {
    const result = await ingestBlogPosts(adapter.collect(), {
      duplicatePolicy: args.includes('--update') ? 'update' : 'skip',
      imageResolver: createRemoteImageResolver(),
      attribution: categoryRow
        ? {
            syncSourceId: categoryRow.syncSourceId,
            syncSourceCategoryId: categoryRow.id,
          }
        : undefined,
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await disconnectDatabase();
  }
};

run().catch((error) => {
  console.error('Ingestion failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
