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
import { parseRssArticle, type RssArticle } from './rss.js';

export type GenericHtmlListingItem = {
  url: string;
  title?: string;
  imageUrl?: string;
};

/**
 * Extracts unique same-host article links from a listing page. `pattern` is a
 * regex applied to each `href` — e.g. `/news/[a-z0-9-]+-\d+\.html`. Title and
 * thumbnail are read from the anchor's inner markup/`title` attr.
 */
export const parseGenericHtmlListing = (
  html: string,
  baseUrl: string,
  pattern: RegExp,
  exclude?: RegExp,
): GenericHtmlListingItem[] => {
  const hostname = new URL(baseUrl).hostname;
  const items: GenericHtmlListingItem[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const [, href, inner] = match;
    let url: URL;
    try {
      url = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (url.hostname !== hostname) continue;
    const path = url.pathname;
    if (!pattern.test(path) || (exclude && exclude.test(path))) continue;
    url.search = '';
    url.hash = '';
    const title =
      stripTags(inner) || stripTags(readAttr(match[0], 'title') ?? readAttr(inner, 'alt') ?? '');
    // Prefer the titled anchor for a URL, but never skip a card entirely.
    const key = url.toString();
    const imageUrl = readAttr(inner, 'data-src') ?? readAttr(inner, 'src');
    if (!title && seen.has(key)) continue;
    if (title && seen.has(key)) {
      const existing = items.findIndex((item) => item.url === key);
      if (existing !== -1)
        items[existing] = { url: key, title, imageUrl: imageUrl ?? items[existing].imageUrl };
      continue;
    }
    seen.add(key);
    items.push({ url: key, title: title || undefined, imageUrl });
  }
  return items;
};

export type GenericHtmlAdapterOptions = {
  /** Listing page URL (SyncSourceCategory.listingUrl). Required. */
  listingUrl: string;
  /** Regex matched against each href — identifies article links. Required. */
  articleUrlPattern: string;
  /** Regex rejecting matching hrefs (nav, author, tag pages). */
  excludeUrlPattern?: string;
  /** extraDivByMarker fallback for the article body, e.g. 'field-name-body'. */
  bodyMarker?: string;
  /** Pagination query param; 'page' default, 'none' disables pagination. */
  pageParam?: string;
  /** Listing pages per run. Defaults to 1. */
  maxPages?: number;
  /** Pause between page and article requests. Defaults to 1000ms. */
  delayMs?: number;
  /** ISO 8601 lower bound on publish date; stops at the first older story. */
  after?: string;
  /** Locale for non-English sites (mirrored into en-IN). */
  contentLocale?: string;
  categoryKeys?: string[];
  locationKeys?: string[];
  /** Defaults to DRAFT; pass PUBLISHED only for a trusted direct-publish run. */
  initialStatus?: 'DRAFT' | 'PUBLISHED';
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

/**
 * Config-driven HTML adapter for simple listing sites: article links are
 * identified by a regex (adapterConfig.articleUrlPattern), pagination is a
 * `?page=N`-style query param (adapterConfig.pageParam), and each article is
 * extracted with the shared NewsArticle/og:/container heuristics (a
 * bodyMarker can override the body container). Any site fitting this shape is
 * a data-only onboarding — no code, just a SyncSourceCategory row.
 */
const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** Some WAFs return 200 OK with a block/challenge body instead of a 4xx. */
const looksLikeChallenge = (html: string): boolean =>
  html.length < 4000 &&
  /<title>\s*(403|404|access denied|attention required|just a moment|forbidden)/i.test(html);

/** Wraps fetchImpl with a browser-ish UA unless the caller already sets one. */
const withUserAgent = (fetchImpl: typeof fetch): typeof fetch => {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    if (!headers.has('user-agent')) headers.set('user-agent', DEFAULT_UA);
    if (!headers.has('accept-language')) headers.set('accept-language', 'en-US,en;q=0.9');
    return fetchImpl(input, { ...init, headers });
  };
};

export class GenericHtmlAdapter implements WebsiteIngestionAdapter {
  readonly source = 'WEBSITE' as const;

  constructor(private readonly options: GenericHtmlAdapterOptions) {}

  private idPrefix(): string {
    return `html-${new URL(this.options.listingUrl).hostname
      .replace(/^www\./, '')
      .replace(/\./g, '-')}`;
  }

  private sourceItemId(url: string): string {
    const numeric = url.match(/(\d{4,})(?:\.(?:html?|cms|ece|aspx?|php))?$/i)?.[1];
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop() ?? url;
    return `${this.idPrefix()}-${numeric ?? slug.replace(/\.[^.]+$/, '')}`;
  }

  private parseArticle(html: string): RssArticle {
    const article = parseRssArticle(html);
    if (article.content || !this.options.bodyMarker) return article;
    const body = extractDivByMarker(html, this.options.bodyMarker);
    const paragraphs = paragraphsIn(body)
      .map((p) => stripTags(p))
      .filter((p) => p.length > 1);
    return { ...article, content: paragraphs.length ? paragraphs.join('\n') : undefined };
  }

  private async *emitItem(
    item: GenericHtmlListingItem,
    fetchImpl: typeof fetch,
  ): AsyncGenerator<AdapterInput, boolean> {
    const article = await fetchImpl(item.url)
      .then(async (response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        const html = await response.text();
        if (looksLikeChallenge(html)) throw new Error('blocked by challenge page');
        return this.parseArticle(html);
      })
      .catch((error) => {
        console.warn(
          `generic-html article skipped for ${item.url}: ${
            error instanceof Error ? error.message : error
          }`,
        );
        return undefined;
      });
    const title = article?.title ?? item.title;
    const content = article?.content;
    if (!title || !content) return true;
    const after = this.options.after ? new Date(this.options.after) : undefined;
    if (after && article?.publishedAt && article.publishedAt < after) return false;

    const imageRaw = article?.imageUrl ?? item.imageUrl;
    let imageUrl: string | undefined;
    try {
      imageUrl = imageRaw ? new URL(imageRaw, item.url).toString() : undefined;
    } catch {
      imageUrl = undefined;
    }

    const contentLocale = this.options.contentLocale ?? 'en-IN';
    const translations =
      contentLocale === 'en-IN'
        ? [{ locale: 'en-IN', title, content }]
        : [
            { locale: contentLocale, title, content },
            { locale: 'en-IN', title, content },
          ];

    const now = (this.options.now?.() ?? new Date()).toISOString();
    yield {
      source: this.source,
      sourceItemId: this.sourceItemId(item.url),
      canonicalUrl: stripQuery(item.url),
      summary: article?.summary,
      imageUrl,
      externalRedirectUrl: item.url,
      translations,
      categoryKeys: this.options.categoryKeys ?? ['news'],
      locationKeys: this.options.locationKeys ?? ['india'],
      discoveredAt: now,
      fetchedAt: now,
      crawlerName: `${this.idPrefix()}-html`,
      crawlerVersion: '1',
      initialStatus: this.options.initialStatus ?? 'DRAFT',
    };
    return true;
  }

  async *collect(): AsyncIterable<unknown> {
    const {
      listingUrl,
      articleUrlPattern,
      pageParam = 'page',
      maxPages = 1,
      delayMs = 1000,
      fetchImpl: fetchImplOption = fetch,
    } = this.options;
    const fetchImpl = withUserAgent(fetchImplOption);
    const pattern = new RegExp(articleUrlPattern, 'i');
    const exclude = this.options.excludeUrlPattern
      ? new RegExp(this.options.excludeUrlPattern, 'i')
      : undefined;

    const seen = new Set<string>();
    for (let page = 1; page <= maxPages; page += 1) {
      const url = new URL(listingUrl);
      if (page > 1 && pageParam !== 'none') url.searchParams.set(pageParam, String(page));
      const response = await fetchImpl(url);
      if (!response.ok) {
        if (page > 1 && (response.status === 404 || response.status === 301)) return;
        throw new Error(
          `generic-html listing failed with ${response.status} for ${url.toString()}`,
        );
      }
      const html = await response.text();
      const items = parseGenericHtmlListing(html, url.toString(), pattern, exclude).filter(
        (item) => {
          if (seen.has(item.url)) return false;
          seen.add(item.url);
          return true;
        },
      );
      if (page === 1 && items.length === 0) {
        if (looksLikeChallenge(html))
          throw new Error(`generic-html listing blocked by challenge page for ${url.toString()}`);
        return;
      }
      for (const item of items) {
        if (delayMs > 0) await sleep(delayMs);
        if (!(yield* this.emitItem(item, fetchImpl))) return;
      }
      if (page < maxPages && delayMs > 0) await sleep(delayMs);
    }
  }
}

// Re-exported so callers can probe metadata without fetching twice.
export { findLdJson, readMeta };
