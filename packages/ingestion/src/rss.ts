import type { AdapterInput, WebsiteIngestionAdapter } from './adapters.js';
import {
  extractDivByMarker,
  findLdJson,
  paragraphsIn,
  readAttr,
  readMeta,
  sleep,
  stripQuery,
  stripTags,
} from './html.js';

export type RssFeedItem = {
  url: string;
  title: string;
  summary?: string;
  imageUrl?: string;
  publishedAt?: Date;
  /** Full body when the feed carries content:encoded or an HTML description. */
  content?: string;
};

export type RssArticle = {
  title?: string;
  summary?: string;
  content?: string;
  imageUrl?: string;
  publishedAt?: Date;
};

const readCdata = (block: string, tag: string) =>
  block
    .match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))?.[1]
    .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')
    .trim();

const paragraphsFromHtml = (html: string) => {
  const paragraphs = paragraphsIn(html)
    .map((p) => stripTags(p))
    .filter(Boolean);
  if (paragraphs.length) return paragraphs.join('\n');
  const text = stripTags(html);
  return text || undefined;
};

/** Finds the `<link rel="alternate" type="application/rss+xml">` href of a page. */
export const parseRssFeedUrl = (html: string): string | undefined => {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/type\s*=\s*["']application\/(rss|atom)\+xml["']/i.test(tag)) continue;
    const href = readAttr(tag, 'href');
    if (href) return href;
  }
  return undefined;
};

/**
 * Parses an RSS 2.0 feed: items carry `<link>`/`<guid>` article URLs, CDATA
 * text fields, optional `<enclosure>`/`media:` images, `<pubDate>`/`dc:date`,
 * and optionally a full `<content:encoded>` body. Items are newest-first.
 */
export const parseRssFeed = (xml: string): RssFeedItem[] => {
  const items: RssFeedItem[] = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = match[1];
    const url = stripTags(readCdata(block, 'link') ?? '');
    const title = stripTags(readCdata(block, 'title') ?? '');
    if (!url || !title) continue;

    const enclosure = block.match(/<enclosure\b[^>]*>/i)?.[0];
    const media =
      block.match(/<media:(content|thumbnail)\b[^>]*>/i)?.[0] ??
      block.match(/<image\b[^>]*>([\s\S]*?)<\/image>/i)?.[0];
    const mediaUrl = media
      ? (readAttr(media, 'url') ?? (stripTags(readCdata(block, 'image') ?? '') || undefined))
      : undefined;

    const encoded = readCdata(block, 'content:encoded');
    const description = readCdata(block, 'description');
    const publishedRaw = readCdata(block, 'pubDate') ?? readCdata(block, 'dc:date');
    const publishedAt = publishedRaw ? new Date(publishedRaw) : undefined;

    items.push({
      url,
      title,
      summary: description ? stripTags(description).slice(0, 500) || undefined : undefined,
      imageUrl: enclosure ? readAttr(enclosure, 'url') : mediaUrl,
      content:
        encoded && /</.test(encoded) ? paragraphsFromHtml(encoded) : encoded?.trim() || undefined,
      publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined,
    });
  }
  return items;
};

/**
 * Generic article-page extractor for feeds that only carry summaries. Tries
 * NewsArticle ld+json + og:/meta tags, then the first of: `articleBody`
 * itemprop div, `<article>` paragraphs, or a `class` matching common body
 * containers (article-body, entry-content, post-content, story-content).
 */
export const parseRssArticle = (html: string): RssArticle => {
  const ld = findLdJson(html, 'NewsArticle');
  const ldImage = ld?.image as { url?: string } | string | Array<{ url?: string }> | undefined;

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
    (typeof ldImage === 'string'
      ? ldImage
      : Array.isArray(ldImage)
        ? ldImage[0]?.url
        : ldImage?.url) ?? readMeta(html, 'og:image');

  const publishedRaw =
    (typeof ld?.datePublished === 'string' ? ld.datePublished : undefined) ??
    readMeta(html, 'article:published_time');
  const publishedAt = publishedRaw ? new Date(publishedRaw) : undefined;

  const ldBody = typeof ld?.articleBody === 'string' ? stripTags(ld.articleBody) : undefined;
  // Some sites emit malformed ld+json — recover articleBody with a regex.
  const rawLdBody =
    ldBody ?? html.match(/"articleBody"\s*:\s*"((?:[^"\\]|\\.)*)"/i)?.[1]?.replace(/\\"/g, '"');

  let content = rawLdBody && rawLdBody.length > 200 ? stripTags(rawLdBody) : undefined;
  if (!content) {
    const container =
      extractDivByMarker(html, 'itemprop="articleBody"') ||
      html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ||
      extractDivByMarker(html, 'article-body') ||
      extractDivByMarker(html, 'articleBody') ||
      extractDivByMarker(html, 'entry-content') ||
      extractDivByMarker(html, 'post-content') ||
      extractDivByMarker(html, 'story-content') ||
      extractDivByMarker(html, 'arti-flow') ||
      extractDivByMarker(html, 'article_text') ||
      extractDivByMarker(html, 'fulltext') ||
      extractDivByMarker(html, 'item-page');
    content = container ? paragraphsFromHtml(container) : undefined;
  }

  return {
    title,
    summary,
    imageUrl,
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined,
    content,
  };
};

export type RssAdapterOptions = {
  /** Direct feed URL — preferred (adapterConfig.feedUrl). */
  feedUrl?: string;
  /** Listing URL whose `<link rel="alternate">` exposes the feed. */
  listingUrl?: string;
  /** sourceItemId prefix + crawlerName segment; defaults to feed hostname slug. */
  idPrefix?: string;
  /** Max items per run. Defaults to 25. */
  maxItems?: number;
  /** Force fetching article pages even when the feed carries content. */
  fetchArticles?: boolean;
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
 * Generic RSS adapter: collects feed items (from `feedUrl`, or discovered via
 * the listing page's `<link rel="alternate">`), uses `content:encoded` when
 * present, otherwise fetches each article page and extracts the body with
 * common NewsArticle/container heuristics. Any RSS-capable source can be
 * onboarded with a SyncSource + SyncSourceCategory row and no new code.
 */
export class RssAdapter implements WebsiteIngestionAdapter {
  readonly source = 'WEBSITE' as const;

  constructor(private readonly options: RssAdapterOptions = {}) {}

  private idPrefix(): string {
    if (this.options.idPrefix) return this.options.idPrefix;
    const host = (this.options.feedUrl ?? this.options.listingUrl ?? 'feed')
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\./g, '-')
      .replace(/\/.*$/, '');
    return `rss-${host}`;
  }

  private sourceItemId(url: string): string {
    const numeric = url.match(/(\d{4,})(?:\.(?:html?|cms|ece|aspx?|php))?$/i)?.[1];
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop() ?? url;
    return `${this.idPrefix()}-${numeric ?? slug.replace(/\.[^.]+$/, '')}`;
  }

  private async fetchArticle(url: string, fetchImpl: typeof fetch) {
    const response = await fetchImpl(url);
    if (!response.ok) {
      throw new Error(`article request failed with ${response.status} for ${url}`);
    }
    return parseRssArticle(await response.text());
  }

  private async *emitItem(
    item: RssFeedItem,
    fetchImpl: typeof fetch,
  ): AsyncGenerator<AdapterInput, boolean> {
    const after = this.options.after ? new Date(this.options.after) : undefined;
    if (after && item.publishedAt && item.publishedAt < after) return false;

    let article: RssArticle | undefined;
    const needArticle = this.options.fetchArticles ?? !item.content;
    if (needArticle) {
      article = await this.fetchArticle(item.url, fetchImpl).catch((error) => {
        console.warn(
          `RSS article skipped for ${item.url}: ${error instanceof Error ? error.message : error}`,
        );
        return undefined;
      });
    }

    const title = article?.title ?? item.title;
    const content = article?.content ?? item.content;
    if (!title || !content) return true;
    const publishedAt = article?.publishedAt ?? item.publishedAt;
    if (after && publishedAt && publishedAt < after) return false;

    const imageRaw = article?.imageUrl ?? item.imageUrl;
    let imageUrl: string | undefined;
    try {
      imageUrl = imageRaw ? new URL(imageRaw, item.url).toString() : undefined;
    } catch {
      imageUrl = undefined;
    }

    const now = (this.options.now?.() ?? new Date()).toISOString();
    yield {
      source: this.source,
      sourceItemId: this.sourceItemId(item.url),
      canonicalUrl: stripQuery(item.url),
      summary: article?.summary ?? item.summary,
      imageUrl,
      externalRedirectUrl: stripQuery(item.url),
      translations: [{ locale: 'en-IN', title, content }],
      categoryKeys: this.options.categoryKeys ?? ['news'],
      locationKeys: this.options.locationKeys ?? ['india'],
      discoveredAt: now,
      fetchedAt: now,
      crawlerName: `${this.idPrefix()}-rss`,
      crawlerVersion: '1',
      initialStatus: this.options.initialStatus ?? 'DRAFT',
    };
    return true;
  }

  async *collect(): AsyncIterable<unknown> {
    const { feedUrl, listingUrl, maxItems = 25, delayMs = 1000, fetchImpl = fetch } = this.options;

    let resolvedFeedUrl = feedUrl;
    if (!resolvedFeedUrl) {
      if (!listingUrl) throw new Error('RssAdapter requires feedUrl or listingUrl');
      const listingResponse = await fetchImpl(listingUrl);
      if (!listingResponse.ok) {
        throw new Error(`RSS listing failed with ${listingResponse.status} for ${listingUrl}`);
      }
      const href = parseRssFeedUrl(await listingResponse.text());
      resolvedFeedUrl = href ? new URL(href, listingUrl).toString() : undefined;
      if (!resolvedFeedUrl) {
        throw new Error(`RSS listing has no feed link for ${listingUrl}`);
      }
    }

    const feedResponse = await fetchImpl(resolvedFeedUrl);
    if (!feedResponse.ok) {
      throw new Error(`RSS feed failed with ${feedResponse.status} for ${resolvedFeedUrl}`);
    }
    for (const item of parseRssFeed(await feedResponse.text()).slice(0, maxItems)) {
      const needArticle = this.options.fetchArticles ?? !item.content;
      if (needArticle && delayMs > 0) await sleep(delayMs);
      if (!(yield* this.emitItem(item, fetchImpl))) return;
    }
  }
}
