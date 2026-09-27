import type { AdapterInput, WebsiteIngestionAdapter } from './adapters.js';
import { extractDivByMarker, paragraphsIn, readMeta, sleep, stripTags } from './html.js';

export type TheHinduListingItem = {
  url: string;
  title: string;
  imageUrl?: string;
};

export type TheHinduArticle = {
  title?: string;
  summary?: string;
  content?: string;
  imageUrl?: string;
  publishedAt?: Date;
};

/**
 * Parses a The Hindu topic listing: story cards are `<h3 class="title">
 * <a href=".../article<id>.ece">` pairs on the topic hostname. Sidebar and
 * trending widgets are ignored — they use different markup. Pagination is
 * `?page=N`.
 */
export const parseTheHinduListing = (
  html: string,
  listingUrl = 'https://www.thehindu.com/topic/Agriculture/',
): TheHinduListingItem[] => {
  const listingHost = new URL(listingUrl).hostname;
  const cardPattern =
    /<h3[^>]*class=["'][^"']*title[^"']*["'][^>]*>\s*<a\b([^>]*href=["']([^"']*article\d+\.ece)["'][^>]*)>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  const items: TheHinduListingItem[] = [];
  for (const match of html.matchAll(cardPattern)) {
    const [, , href, inner] = match;
    const url = new URL(href, listingUrl);
    if (url.hostname !== listingHost) continue;
    url.search = '';
    url.hash = '';
    const key = url.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    const title = stripTags(inner);
    if (!title) continue;
    items.push({ url: key, title });
  }
  return items;
};

/**
 * Extracts a The Hindu article: `og:`/`article:published_time` meta for
 * metadata and the `itemprop="articleBody"` div's paragraphs for the body.
 */
export const parseTheHinduArticle = (html: string): TheHinduArticle => {
  const title =
    stripTags(
      readMeta(html, 'og:title') ?? html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '',
    ) || undefined;

  const summary =
    stripTags(readMeta(html, 'og:description') ?? readMeta(html, 'description', 'name') ?? '') ||
    undefined;

  const imageUrl = readMeta(html, 'og:image');

  const publishedRaw = readMeta(html, 'article:published_time');
  const publishedAt = publishedRaw ? new Date(publishedRaw) : undefined;

  const body = extractDivByMarker(html, 'itemprop="articleBody"');
  const paragraphs = paragraphsIn(body).filter(
    (p) => stripTags(p) && !/^(Also read|COMMents|SHARE)/i.test(stripTags(p)),
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

export type TheHinduAdapterOptions = {
  /** Topic listing URL. Defaults to https://www.thehindu.com/topic/Agriculture/ */
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
 * Collects posts from a The Hindu topic listing (default: Agriculture).
 * Listing pages are scraped from HTML (`?page=N` pagination); every story
 * page is then fetched for its `articleBody` paragraphs and meta metadata.
 * Article URLs live under section paths (`/news/...`, `/business/...`), not
 * the topic path — auto-attribution assigns the source but not a category.
 * Posts are emitted as WEBSITE adapter input; the ingestion service applies
 * normalization, dedup on sourceItemId/canonicalUrl, and keeps everything as
 * DRAFT unless overridden.
 */
export class TheHinduAdapter implements WebsiteIngestionAdapter {
  readonly source = 'WEBSITE' as const;

  constructor(private readonly options: TheHinduAdapterOptions = {}) {}

  private sourceItemId(url: string): string {
    const id = url.match(/article(\d+)\.ece/)?.[1];
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop() ?? url;
    return `thehindu-${id ?? slug}`;
  }

  private async fetchArticle(url: string, fetchImpl: typeof fetch) {
    const response = await fetchImpl(url);
    if (!response.ok) {
      throw new Error(`article request failed with ${response.status} for ${url}`);
    }
    return parseTheHinduArticle(await response.text());
  }

  /**
   * Fetches one story page and yields the mapped input. Returns false when the
   * story predates the `after` bound — listings are newest-first, so the caller
   * stops collecting entirely.
   */
  private async *emitItem(
    item: TheHinduListingItem,
    fetchImpl: typeof fetch,
  ): AsyncGenerator<AdapterInput, boolean> {
    const article = await this.fetchArticle(item.url, fetchImpl).catch((error) => {
      console.warn(
        `TheHindu article skipped for ${item.url}: ${
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
      crawlerName: 'thehindu-html',
      crawlerVersion: '1',
      initialStatus: this.options.initialStatus ?? 'DRAFT',
    };
    return true;
  }

  async *collect(): AsyncIterable<unknown> {
    const {
      listingUrl = 'https://www.thehindu.com/topic/Agriculture/',
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
        throw new Error(`TheHindu listing failed with ${response.status} for ${url.toString()}`);
      }
      const items = parseTheHinduListing(await response.text(), listingUrl).filter((item) => {
        if (seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      });
      if (page === 1 && items.length === 0) return;
      for (const item of items) {
        if (delayMs > 0) await sleep(delayMs);
        if (!(yield* this.emitItem(item, fetchImpl))) return;
      }
      if (page < maxPages && delayMs > 0) await sleep(delayMs);
    }
  }
}
