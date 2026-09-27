import type { AdapterInput, WebsiteIngestionAdapter } from './adapters.js';
import {
  extractDivByMarker,
  findLdJson,
  paragraphsIn,
  readAttr,
  readMeta,
  sleep,
  stripTags,
} from './html.js';

export type AgricultureDiveListingItem = {
  url: string;
  title: string;
  imageUrl?: string;
};

export type AgricultureDiveArticle = {
  title?: string;
  summary?: string;
  content?: string;
  imageUrl?: string;
  publishedAt?: Date;
};

/**
 * Parses a Dive topic listing: every story card links to
 * `/news/<slug>/<numericId>/` (root-relative). Pagination is `?page=N`.
 */
export const parseAgricultureDiveListing = (
  html: string,
  baseUrl = 'https://www.agriculturedive.com',
): AgricultureDiveListingItem[] => {
  const anchorPattern =
    /<a\b[^>]*href=["']([^"']*\/news\/[a-z0-9-]+\/\d+\/?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  const items: AgricultureDiveListingItem[] = [];
  for (const match of html.matchAll(anchorPattern)) {
    const [, href, inner] = match;
    const url = new URL(href, baseUrl);
    if (url.hostname !== new URL(baseUrl).hostname) continue;
    url.search = '';
    url.hash = '';
    const title = stripTags(inner) || stripTags(readAttr(match[0], 'title') ?? '');
    if (!title) continue;
    const key = url.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    const imageUrl = readAttr(inner, 'data-src') ?? readAttr(inner, 'src');
    items.push({ url: key, title, imageUrl });
  }
  return items;
};

/**
 * Extracts an Agriculture Dive article: NewsArticle ld+json for metadata and
 * the `.article-body` div's paragraphs for the body (text-to-speech widget,
 * newsletter promos and share widgets inside it are skipped as non-<p> or
 * filtered out by content checks).
 */
export const parseAgricultureDiveArticle = (html: string): AgricultureDiveArticle => {
  const ld = findLdJson(html, 'NewsArticle');
  const ldImage = ld?.image as { url?: string } | string | undefined;

  const title =
    stripTags(
      (typeof ld?.headline === 'string' ? ld.headline : undefined) ??
        readMeta(html, 'og:title') ??
        html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ??
        '',
    ) || undefined;

  const summary =
    stripTags(
      (typeof ld?.description === 'string' ? ld.description : undefined) ??
        readMeta(html, 'og:description') ??
        readMeta(html, 'description', 'name') ??
        '',
    ) || undefined;

  const imageUrl =
    (typeof ldImage === 'string' ? ldImage : ldImage?.url) ?? readMeta(html, 'og:image');

  const publishedRaw =
    (typeof ld?.datePublished === 'string' ? ld.datePublished : undefined) ??
    readMeta(html, 'article:published_time');
  const publishedAt = publishedRaw ? new Date(publishedRaw) : undefined;

  const body = extractDivByMarker(html, 'article-body');
  const paragraphs = paragraphsIn(body).filter(
    (p) => stripTags(p) && !/free daily newsletter/i.test(p),
  );
  const content = paragraphs.length ? paragraphs.join('\n') : undefined;

  return {
    title,
    summary,
    imageUrl,
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined,
    content,
  };
};

export type AgricultureDiveAdapterOptions = {
  /** Topic listing URL. Defaults to https://www.agriculturedive.com/topic/crops/ */
  listingUrl?: string;
  /** Listing pages to walk per run (`?page=N`). Defaults to 1. */
  maxPages?: number;
  /** Pause between page and article requests. Defaults to 1000ms. */
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
 * Collects posts from an Agriculture Dive topic listing (default: crops).
 * Listing pages are scraped from HTML (`?page=N` pagination); every story
 * page is then fetched for its `.article-body` paragraphs and NewsArticle
 * metadata. Posts are emitted as WEBSITE adapter input; the ingestion
 * service applies normalization, dedup on sourceItemId/canonicalUrl, and
 * keeps everything as DRAFT unless overridden.
 */
export class AgricultureDiveAdapter implements WebsiteIngestionAdapter {
  readonly source = 'WEBSITE' as const;

  constructor(private readonly options: AgricultureDiveAdapterOptions = {}) {}

  private sourceItemId(url: string): string {
    const id = url.match(/\/news\/[a-z0-9-]+\/(\d+)/)?.[1];
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop() ?? url;
    return `agriculturedive-${id ?? slug}`;
  }

  private async fetchArticle(url: string, fetchImpl: typeof fetch) {
    const response = await fetchImpl(url);
    if (!response.ok) {
      throw new Error(`article request failed with ${response.status} for ${url}`);
    }
    return parseAgricultureDiveArticle(await response.text());
  }

  /**
   * Fetches one story page and yields the mapped input. Returns false when the
   * story predates the `after` bound — listings are newest-first, so the caller
   * stops collecting entirely.
   */
  private async *emitItem(
    item: AgricultureDiveListingItem,
    fetchImpl: typeof fetch,
  ): AsyncGenerator<AdapterInput, boolean> {
    const article = await this.fetchArticle(item.url, fetchImpl).catch((error) => {
      console.warn(
        `AgricultureDive article skipped for ${item.url}: ${
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
      crawlerName: 'agriculturedive-html',
      crawlerVersion: '1',
      initialStatus: this.options.initialStatus ?? 'DRAFT',
    };
    return true;
  }

  async *collect(): AsyncIterable<unknown> {
    const {
      listingUrl = 'https://www.agriculturedive.com/topic/crops/',
      maxPages = 1,
      delayMs = 1000,
      fetchImpl = fetch,
    } = this.options;

    const seen = new Set<string>();
    for (let page = 1; page <= maxPages; page += 1) {
      const url = new URL(listingUrl);
      if (page > 1) url.searchParams.set('page', String(page));
      const response = await fetchImpl(url);
      if (!response.ok) {
        if (page > 1 && response.status === 404) return;
        throw new Error(
          `AgricultureDive listing failed with ${response.status} for ${url.toString()}`,
        );
      }
      const items = parseAgricultureDiveListing(await response.text(), url.origin).filter(
        (item) => {
          if (seen.has(item.url)) return false;
          seen.add(item.url);
          return true;
        },
      );
      if (page === 1 && items.length === 0) return;
      for (const item of items) {
        if (delayMs > 0) await sleep(delayMs);
        if (!(yield* this.emitItem(item, fetchImpl))) return;
      }
      if (page < maxPages && delayMs > 0) await sleep(delayMs);
    }
  }
}
