import type { AdapterInput, WebsiteIngestionAdapter } from './adapters.js';
import { decodeHtmlEntities } from './chinimandi.js';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const readAttr = (markup: string, name: string) =>
  markup.match(new RegExp(`${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'))?.[2];

const readMeta = (html: string, key: string, attr: 'property' | 'name' = 'property') => {
  const tag = html.match(
    new RegExp(`<meta[^>]*${attr}=["']${escapeRegExp(key)}["'][^>]*>`, 'i'),
  )?.[0];
  return tag ? readAttr(tag, 'content') : undefined;
};

export type BusinessLineListingItem = {
  url: string;
  title: string;
  imageUrl?: string;
};

export type BusinessLineArticle = {
  title?: string;
  summary?: string;
  content?: string;
  imageUrl?: string;
  publishedAt?: Date;
};

/**
 * Extracts the element whose opening `<div ...>` tag contains `marker`
 * (e.g. `itemprop="articleBody"`) by scanning `<div`/`</div>` tokens until the
 * nesting depth returns to zero. Returns the div's inner markup.
 */
const extractDivByMarker = (html: string, marker: string): string => {
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return '';
  const divStart = html.lastIndexOf('<div', markerIndex);
  if (divStart === -1) return '';
  const innerStart = html.indexOf('>', markerIndex) + 1;
  let depth = 1;
  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = innerStart;
  for (const match of html.matchAll(tagPattern)) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(innerStart, match.index);
  }
  return '';
};

/**
 * Parses the server-rendered section page: stories appear twice per card — a
 * picture anchor (real image in `data-src-template`; `src` is a lazy-load
 * filler) and an `<h3 class="title">` headline anchor — so entries are merged
 * per article URL. Pagination is plain `?page=N`.
 */
export const parseBusinessLineListing = (
  html: string,
  categoryPath = '/economy/agri-business/',
  baseUrl = 'https://www.thehindubusinessline.com',
): BusinessLineListingItem[] => {
  // Section listings link to same-section stories; /topic/ pages link to
  // stories under their real section paths (/economy/…, /multimedia/…).
  const hrefPattern = categoryPath.startsWith('/topic/')
    ? `[^"']*/article\\d+\\.ece`
    : `[^"']*${escapeRegExp(categoryPath)}[a-zA-Z0-9-]+/article\\d+\\.ece`;
  const anchorPattern = new RegExp(
    `<a\\b([^>]*href=["'](${hrefPattern})["'][^>]*)>([\\s\\S]*?)</a>`,
    'gi',
  );
  const byUrl = new Map<string, BusinessLineListingItem>();
  for (const match of html.matchAll(anchorPattern)) {
    const [, attrs, href, inner] = match;
    const url = new URL(href, baseUrl);
    url.search = '';
    url.hash = '';
    const key = url.toString();
    const title = decodeHtmlEntities(readAttr(attrs, 'title') ?? inner.replace(/<[^>]*>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    const imageUrl = readAttr(inner, 'data-src-template');
    const existing = byUrl.get(key);
    byUrl.set(key, {
      url: key,
      title: existing?.title || title,
      imageUrl: existing?.imageUrl ?? imageUrl,
    });
  }
  return [...byUrl.values()].filter((item) => item.title);
};

/**
 * Extracts the article body and metadata from a BusinessLine story page. The
 * body lives in `<div id="ControlPara" itemprop="articleBody">` as `<p>`
 * paragraphs interleaved with `article-picture` figures (ignored). Headline,
 * description, image and publish date come from og:/article: meta tags.
 */
export const parseBusinessLineArticle = (html: string): BusinessLineArticle => {
  const title =
    decodeHtmlEntities(
      readMeta(html, 'og:title') ?? html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '',
    )
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || undefined;

  const summary =
    decodeHtmlEntities(
      readMeta(html, 'og:description') ?? readMeta(html, 'description', 'name') ?? '',
    )
      .replace(/\s+/g, ' ')
      .trim() || undefined;

  const imageUrl = readMeta(html, 'og:image');

  const publishedRaw = readMeta(html, 'article:published_time');
  const publishedAt = publishedRaw ? new Date(publishedRaw) : undefined;

  const body = extractDivByMarker(html, 'itemprop="articleBody"');
  const paragraphs = [...body.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi)].map((m) => m[0]);
  const content = paragraphs.length ? paragraphs.join('\n') : body || undefined;

  return {
    title,
    summary,
    imageUrl,
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined,
    content,
  };
};

export type BusinessLineAdapterOptions = {
  /** Site origin. Defaults to https://www.thehindubusinessline.com */
  baseUrl?: string;
  /** Section listing path. Defaults to /economy/agri-business/ */
  categoryPath?: string;
  /**
   * Listing pages to walk per run (`?page=N`). Out-of-range pages 301 back to
   * the section root, which also stops the walk. Defaults to 1.
   */
  maxPages?: number;
  /** Pause between page and article requests. Defaults to 1000ms; pass 0 in tests. */
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
 * Collects posts from a The Hindu BusinessLine section listing (default: agri
 * business). Each listing page is scraped from HTML (`?page=N` pagination);
 * every story page is then fetched for its `articleBody` paragraphs and
 * meta-tag metadata. Posts are emitted as WEBSITE adapter input; the ingestion
 * service applies normalization, dedup on sourceItemId/canonicalUrl, and keeps
 * everything as DRAFT unless overridden.
 */
export class BusinessLineAdapter implements WebsiteIngestionAdapter {
  readonly source = 'WEBSITE' as const;

  constructor(private readonly options: BusinessLineAdapterOptions = {}) {}

  private sourceItemId(url: string): string {
    const articleId = url.match(/\/article(\d+)\.ece/)?.[1];
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop() ?? url;
    return `businessline-${articleId ?? slug}`;
  }

  private async fetchArticle(url: string, fetchImpl: typeof fetch) {
    const response = await fetchImpl(url);
    if (!response.ok) {
      throw new Error(`article request failed with ${response.status} for ${url}`);
    }
    return parseBusinessLineArticle(await response.text());
  }

  /**
   * Fetches one story page and yields the mapped input. Returns false when the
   * story predates the `after` bound — listings are newest-first, so the caller
   * stops collecting entirely.
   */
  private async *emitItem(
    item: BusinessLineListingItem,
    fetchImpl: typeof fetch,
  ): AsyncGenerator<AdapterInput, boolean> {
    const article = await this.fetchArticle(item.url, fetchImpl).catch((error) => {
      console.warn(
        `BusinessLine article skipped for ${item.url}: ${
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
      crawlerName: 'businessline-html',
      crawlerVersion: '1',
      initialStatus: this.options.initialStatus ?? 'DRAFT',
    };
    return true;
  }

  async *collect(): AsyncIterable<unknown> {
    const {
      baseUrl = 'https://www.thehindubusinessline.com',
      categoryPath = '/economy/agri-business/',
      maxPages = 1,
      delayMs = 1000,
      fetchImpl = fetch,
    } = this.options;

    const seen = new Set<string>();
    for (let page = 1; page <= maxPages; page += 1) {
      const listingUrl = new URL(categoryPath, baseUrl);
      if (page > 1) listingUrl.searchParams.set('page', String(page));
      const response = await fetchImpl(listingUrl);
      // Past the last page the site 301s back to the section root.
      if (response.redirected) return;
      if (!response.ok) {
        throw new Error(
          `BusinessLine listing failed with ${response.status} for ${listingUrl.toString()}`,
        );
      }
      const items = parseBusinessLineListing(await response.text(), categoryPath, baseUrl).filter(
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
