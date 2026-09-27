import type { AdapterInput, WebsiteIngestionAdapter } from './adapters.js';
import { findLdJson, paragraphsIn, readAttr, sleep, stripQuery, stripTags } from './html.js';

export type EconomicTimesFeedItem = {
  url: string;
  title: string;
  imageUrl?: string;
  description?: string;
  publishedAt?: Date;
};

export type EconomicTimesArticle = {
  title?: string;
  summary?: string;
  content?: string;
  imageUrl?: string;
  publishedAt?: Date;
};

/** Reads the `<link rel="alternate" type="application/rss+xml">` of a section page. */
export const parseEconomicTimesFeedUrl = (html: string): string | undefined => {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/type=["']application\/rss\+xml["']/i.test(tag)) continue;
    const href = readAttr(tag, 'href');
    if (href) return href;
  }
  return undefined;
};

/**
 * Parses the ET RSS feed: items carry `<link>`/`<guid>` article URLs, a CDATA
 * summary, an `<enclosure>` image and `<pubDate>`. Items are newest-first.
 */
export const parseEconomicTimesFeed = (xml: string): EconomicTimesFeedItem[] => {
  const readCdata = (block: string, tag: string) =>
    block
      .match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))?.[1]
      .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');
  const items: EconomicTimesFeedItem[] = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = match[1];
    const url = stripTags(readCdata(block, 'link') ?? '');
    const title = stripTags(readCdata(block, 'title') ?? '');
    if (!url || !title) continue;
    const enclosure = block.match(/<enclosure\b[^>]*>/i)?.[0];
    const publishedRaw = stripTags(readCdata(block, 'pubDate') ?? '');
    const publishedAt = publishedRaw ? new Date(publishedRaw) : undefined;
    items.push({
      url,
      title,
      imageUrl: enclosure ? readAttr(enclosure, 'url') : undefined,
      description: stripTags(readCdata(block, 'description') ?? '') || undefined,
      publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined,
    });
  }
  return items;
};

/**
 * Extracts an ET article: NewsArticle ld+json for metadata and the
 * `<article>` paragraphs for the body (in-article widgets are skipped).
 */
export const parseEconomicTimesArticle = (html: string): EconomicTimesArticle => {
  const ld = findLdJson(html, 'NewsArticle');
  const ldImage = ld?.image as { url?: string } | string | undefined;

  const title =
    stripTags(
      (typeof ld?.headline === 'string' ? ld.headline : undefined) ??
        readAttr(html.match(/<h1\b[^>]*>/i)?.[0] ?? '', 'title') ??
        html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ??
        '',
    ) || undefined;

  const summary =
    stripTags(
      (typeof ld?.description === 'string' ? ld.description : undefined) ??
        html.match(
          /<meta[^>]*(?:property=["']og:description["']|name=["']description["'])[^>]*content=["']([^"']*)["']/i,
        )?.[1] ??
        '',
    ) || undefined;

  const imageUrl =
    (typeof ldImage === 'string' ? ldImage : ldImage?.url) ??
    html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i)?.[1];

  const publishedRaw = typeof ld?.datePublished === 'string' ? ld.datePublished : undefined;
  const publishedAt = publishedRaw ? new Date(publishedRaw) : undefined;

  const articleInner = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? '';
  const paragraphs = paragraphsIn(articleInner).filter((p) => stripTags(p));
  const content = paragraphs.length ? paragraphs.join('\n') : articleInner || undefined;

  return {
    title,
    summary,
    imageUrl,
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined,
    content,
  };
};

export type EconomicTimesAdapterOptions = {
  /** Section listing URL; its RSS <link> is used for discovery. */
  listingUrl?: string;
  /** Direct RSS feed URL — skips the listing fetch (adapterConfig.feedUrl). */
  feedUrl?: string;
  /** Pause between article requests. Defaults to 1000ms; pass 0 in tests. */
  delayMs?: number;
  /** ISO 8601 lower bound on publish date; collecting stops at the first older item. */
  after?: string;
  categoryKeys?: string[];
  locationKeys?: string[];
  /** Defaults to DRAFT; pass PUBLISHED only for a trusted direct-publish run. */
  initialStatus?: 'DRAFT' | 'PUBLISHED';
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

/**
 * Collects posts from an Economic Times section (default: agriculture news)
 * via the section's RSS feed, then fetches each article page for its body and
 * NewsArticle metadata. Posts are emitted as WEBSITE adapter input; the
 * ingestion service applies normalization, dedup on sourceItemId/canonicalUrl,
 * and keeps everything as DRAFT unless overridden.
 */
export class EconomicTimesAdapter implements WebsiteIngestionAdapter {
  readonly source = 'WEBSITE' as const;

  constructor(private readonly options: EconomicTimesAdapterOptions = {}) {}

  private sourceItemId(url: string): string {
    const id = url.match(/articleshow\/(\d+)\.cms/)?.[1];
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop() ?? url;
    return `economictimes-${id ?? slug}`;
  }

  private async fetchArticle(url: string, fetchImpl: typeof fetch) {
    const response = await fetchImpl(url);
    if (!response.ok) {
      throw new Error(`article request failed with ${response.status} for ${url}`);
    }
    return parseEconomicTimesArticle(await response.text());
  }

  /**
   * Fetches one story page and yields the mapped input. Returns false when the
   * story predates the `after` bound — feed items are newest-first, so the
   * caller stops collecting entirely.
   */
  private async *emitItem(
    item: EconomicTimesFeedItem,
    fetchImpl: typeof fetch,
  ): AsyncGenerator<AdapterInput, boolean> {
    const after = this.options.after ? new Date(this.options.after) : undefined;
    if (after && item.publishedAt && item.publishedAt < after) return false;

    const article = await this.fetchArticle(item.url, fetchImpl).catch((error) => {
      console.warn(
        `EconomicTimes article skipped for ${item.url}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return undefined;
    });
    if (!article?.title || !article.content) return true;
    const publishedAt = article.publishedAt ?? item.publishedAt;
    if (after && publishedAt && publishedAt < after) return false;

    const now = (this.options.now?.() ?? new Date()).toISOString();
    yield {
      source: this.source,
      sourceItemId: this.sourceItemId(item.url),
      canonicalUrl: stripQuery(item.url),
      summary: article.summary ?? item.description,
      imageUrl: article.imageUrl ?? item.imageUrl,
      externalRedirectUrl: stripQuery(item.url),
      translations: [{ locale: 'en-IN', title: article.title, content: article.content }],
      categoryKeys: this.options.categoryKeys ?? ['news'],
      locationKeys: this.options.locationKeys ?? ['india'],
      discoveredAt: now,
      fetchedAt: now,
      crawlerName: 'economictimes-rss',
      crawlerVersion: '1',
      initialStatus: this.options.initialStatus ?? 'DRAFT',
    };
    return true;
  }

  async *collect(): AsyncIterable<unknown> {
    const {
      listingUrl = 'https://economictimes.indiatimes.com/news/economy/agriculture',
      feedUrl,
      delayMs = 1000,
      fetchImpl = fetch,
    } = this.options;

    let resolvedFeedUrl = feedUrl;
    if (!resolvedFeedUrl) {
      const listingResponse = await fetchImpl(listingUrl);
      if (!listingResponse.ok) {
        throw new Error(
          `EconomicTimes listing failed with ${listingResponse.status} for ${listingUrl}`,
        );
      }
      resolvedFeedUrl = parseEconomicTimesFeedUrl(await listingResponse.text());
      if (!resolvedFeedUrl) {
        throw new Error(`EconomicTimes listing has no RSS feed link for ${listingUrl}`);
      }
    }

    const feedResponse = await fetchImpl(resolvedFeedUrl);
    if (!feedResponse.ok) {
      throw new Error(
        `EconomicTimes feed failed with ${feedResponse.status} for ${resolvedFeedUrl}`,
      );
    }
    for (const item of parseEconomicTimesFeed(await feedResponse.text())) {
      if (delayMs > 0) await sleep(delayMs);
      if (!(yield* this.emitItem(item, fetchImpl))) return;
    }
  }
}
