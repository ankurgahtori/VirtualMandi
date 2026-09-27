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

const usage = `Usage: tsx src/krishijagran-cli.ts [options]

Collects the latest posts from a Krishi Jagran category listing (default:
commodity news) and ingests them as PUBLISHED blog posts (pass --draft to keep
them unpublished). The first listing page is scraped from HTML; further pages
come from the site's /api/MoreStories endpoint. Safe to run daily: items
already stored under the same source identity are skipped unless --update is
passed.

Options:
  --after <iso>         Stop at the first post published before this timestamp
  --pages <n>           Listing pages to fetch per run (default 1; ~28 stories
                        on page 1, ~12 per extra page)
  --category-path <p>   Category listing path (default /commodity-news)
  --delay-ms <n>        Delay between listing and article requests (default 1000)
  --update              Update existing posts instead of skipping duplicates
  --draft               Ingest as DRAFT instead of the default PUBLISHED
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

  const { KrishiJagranAdapter } = await import('./krishijagran.js');
  const { createRemoteImageResolver } = await import('./image-resolver.js');
  const { ingestBlogPosts } = await import('./service.js');
  const { disconnectDatabase } = await import('@virtual-mandi/database');

  const adapter = new KrishiJagranAdapter({
    after: readFlagValue(args, '--after'),
    maxPages: numeric('--pages'),
    categoryPath: readFlagValue(args, '--category-path'),
    delayMs: numeric('--delay-ms'),
    initialStatus: args.includes('--draft') ? 'DRAFT' : 'PUBLISHED',
  });

  try {
    const result = await ingestBlogPosts(adapter.collect(), {
      duplicatePolicy: args.includes('--update') ? 'update' : 'skip',
      imageResolver: createRemoteImageResolver(),
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await disconnectDatabase();
  }
};

run().catch((error) => {
  console.error('KrishiJagran ingestion failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
