import type { AdapterInput, WebsiteIngestionAdapter } from './adapters.js';
import {
  escapeRegExp,
  extractDivByMarker,
  findLdJson,
  paragraphsIn,
  readAttr,
  readMeta,
  sleep,
  stripTags,
} from './html.js';

export type LiveMintListingItem = {
  url: string;
  title: string;
  imageUrl?: string;
};

export type LiveMintArticle = {
  title?: string;
  summary?: string;
  content?: string;
  imageUrl?: string;
  publishedAt?: Date;
};

/**
 * Parses a Mint section listing: story cards link to
 * `<categoryPath>/<slug>-<numericId>.html` (absolute or root-relative).
 * The section paginates with infinite scroll, so only page 1 exists.
 */
export const parseLiveMintListing = (
  html: string,
  categoryPath = '/industry/agriculture',
  baseUrl = 'https://www.livemint.com',
): LiveMintListingItem[] => {
  const anchorPattern = new RegExp(
    `<a\\b[^>]*href=["']([^"']*${escapeRegExp(
      categoryPath.replace(/\/+$/, ''),
    )}/[a-z0-9-]+-\\d+\\.html[^"']*)["'][^>]*>([\\s\\S]*?)</a>`,
    'gi',
  );
  const seen = new Set<string>();
  const items: LiveMintListingItem[] = [];
  for (const match of html.matchAll(anchorPattern)) {
    const [, href, inner] = match;
    const url = new URL(href, baseUrl);
    url.search = '';
    url.hash = '';
    const key = url.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    const title = stripTags(inner) || stripTags(readAttr(match[0], 'title') ?? '');
    if (!title) continue;
    const imageUrl = readAttr(inner, 'data-src') ?? readAttr(inner, 'src');
    items.push({ url: key, title, imageUrl });
  }
  return items;
};

/**
 * Extracts a Mint article: NewsArticle ld+json for metadata; the body lives
 * in `<div id="article-index-N" class="storyParagraph"><p>…` blocks inside
 * `#mainArea` (paywall wrapper divs are ignored since only paragraphs are read).
 */
export const parseLiveMintArticle = (html: string): LiveMintArticle => {
  const ld = findLdJson(html, 'NewsArticle');
  const ldImage = ld?.image as { url?: string } | string | undefined;

  const title =
    stripTags(
      (typeof ld?.headline === 'string' ? ld.headline : undefined) ??
        readMeta(html, 'og:title') ??
        html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ??
        '',
    ).replace(/\s*\|\s*Mint\s*$/, '') || undefined;

  const summary =
    stripTags(
      (typeof ld?.description === 'string' ? ld.description : undefined) ??
        readMeta(html, 'og:description') ??
        readMeta(html, 'description', 'name') ??
        '',
    ) || undefined;

  const imageUrl =
    (typeof ldImage === 'string' ? ldImage : ldImage?.url) ??
    (Array.isArray(ldImage) ? (ldImage[0] as { url?: string } | undefined)?.url : undefined) ??
    readMeta(html, 'og:image');

  const publishedRaw =
    (typeof ld?.datePublished === 'string' ? ld.datePublished : undefined) ??
    readMeta(html, 'article:published_time');
  const publishedAt = publishedRaw ? new Date(publishedRaw) : undefined;

  const mainArea = extractDivByMarker(html, 'id="mainArea"');
  const body = mainArea || extractDivByMarker(html, 'contentSec');
  const paragraphs = paragraphsIn(body).filter((p) => stripTags(p));
  const content = paragraphs.length ? paragraphs.join('\n') : undefined;

  return {
    title,
    summary,
    imageUrl,
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined,
    content,
  };
};

export type LiveMintAdapterOptions = {
  /** Site origin. Defaults to https://www.livemint.com */
  baseUrl?: string;
  /** Section listing path. Defaults to /industry/agriculture */
  categoryPath?: string;
  /** Pause between listing and article requests. Defaults to 1000ms. */
  delayMs?: number;
  /** ISO 8601 lower bound on publish date; collecting stops at the first older story. */
  after?: string;
  categoryKeys?: string[];
  locationKeys?: string[];
  /** Defaults to DRAFT; pass PUBLISHED only for a trusted direct-publish run. */
  initialStatus?: 'DRAFT' | 'PUBLISHED';
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

/**
 * Collects posts from a Mint section listing (default: agriculture). Mint
 * paginates with client-side infinite scroll, so only the server-rendered
 * first page is walked; each story page is then fetched for its
 * `.storyParagraph` body and NewsArticle metadata. Posts are emitted as
 * WEBSITE adapter input; the ingestion service applies normalization, dedup
 * on sourceItemId/canonicalUrl, and keeps everything as DRAFT unless
 * overridden.
 */
export class LiveMintAdapter implements WebsiteIngestionAdapter {
  readonly source = 'WEBSITE' as const;

  constructor(private readonly options: LiveMintAdapterOptions = {}) {}

  private sourceItemId(url: string): string {
    const id = url.match(/-(\d+)\.html/)?.[1];
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop() ?? url;
    return `livemint-${id ?? slug}`;
  }

  private async fetchArticle(url: string, fetchImpl: typeof fetch) {
    const response = await fetchImpl(url);
    if (!response.ok) {
      throw new Error(`article request failed with ${response.status} for ${url}`);
    }
    return parseLiveMintArticle(await response.text());
  }

  /**
   * Fetches one story page and yields the mapped input. Returns false when the
   * story predates the `after` bound — listings are newest-first, so the caller
   * stops collecting entirely.
   */
  private async *emitItem(
    item: LiveMintListingItem,
    fetchImpl: typeof fetch,
  ): AsyncGenerator<AdapterInput, boolean> {
    const article = await this.fetchArticle(item.url, fetchImpl).catch((error) => {
      console.warn(
        `LiveMint article skipped for ${item.url}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return undefined;
    });
    if (!article?.title || !article.content) return true;
    const after = this.options.after ? new Date(this.options.after) : undefined;
    if (after && article.publishedAt && article.publishedAt < after) return false;

    const now = (this.options.now?.() ?? new Date()).toISOString();
    yield {
      source: this.source,
      sourceItemId: this.sourceItemId(item.url),
      canonicalUrl: item.url,
      summary: article.summary,
      imageUrl: article.imageUrl ?? item.imageUrl,
      externalRedirectUrl: item.url,
      translations: [{ locale: 'en-IN', title: article.title, content: article.content }],
      categoryKeys: this.options.categoryKeys ?? ['news'],
      locationKeys: this.options.locationKeys ?? ['india'],
      discoveredAt: now,
      fetchedAt: now,
      crawlerName: 'livemint-html',
      crawlerVersion: '1',
      initialStatus: this.options.initialStatus ?? 'DRAFT',
    };
    return true;
  }

  async *collect(): AsyncIterable<unknown> {
    const {
      baseUrl = 'https://www.livemint.com',
      categoryPath = '/industry/agriculture',
      delayMs = 1000,
      fetchImpl = fetch,
    } = this.options;

    const listingUrl = new URL(categoryPath, baseUrl);
    const listingResponse = await fetchImpl(listingUrl);
    if (!listingResponse.ok) {
      throw new Error(
        `LiveMint listing failed with ${listingResponse.status} for ${listingUrl.toString()}`,
      );
    }
    for (const item of parseLiveMintListing(await listingResponse.text(), categoryPath, baseUrl)) {
      if (delayMs > 0) await sleep(delayMs);
      if (!(yield* this.emitItem(item, fetchImpl))) return;
    }
  }
}
