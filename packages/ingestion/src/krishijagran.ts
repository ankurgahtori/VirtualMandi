import type { AdapterInput, WebsiteIngestionAdapter } from './adapters.js';
import { decodeHtmlEntities } from './chinimandi.js';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const readAttr = (markup: string, name: string) =>
  markup.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1];

const stripQuery = (value: string) => {
  try {
    const url = new URL(value);
    url.search = '';
    return url.toString();
  } catch {
    return value;
  }
};

export type KrishiJagranListingItem = {
  url: string;
  title: string;
  imageUrl?: string;
  description?: string;
};

type KrishiJagranListingPage = {
  items: KrishiJagranListingItem[];
  /** `var c` — internal category id used by the MoreStories endpoint. */
  categoryId?: string;
  /** `var l` — id of the last rendered story, used as the pagination cursor. */
  lastId?: string;
};

export type KrishiJagranArticle = {
  title?: string;
  summary?: string;
  content?: string;
  imageUrl?: string;
  publishedAt?: Date;
};

type MoreStoriesStory = {
  Id: number;
  Url: string;
  Title?: string;
  CoverImage?: string;
  Desc?: string;
};

/**
 * Parses the server-rendered category page: every story appears as anchors
 * pointing at `/commodity-news/<slug>/` (image card + duplicate headline link),
 * and the page embeds `var c`/`var l` globals the "View More" button passes to
 * /api/MoreStories.
 */
export const parseKrishiJagranListing = (
  html: string,
  categoryPath = '/commodity-news',
  baseUrl = 'https://krishijagran.com',
): KrishiJagranListingPage => {
  const anchorPattern = new RegExp(
    `<a\\b([^>]*href=["'](${escapeRegExp(categoryPath)}/[a-zA-Z0-9-]+/?)["'][^>]*)>([\\s\\S]*?)</a>`,
    'gi',
  );
  const seen = new Set<string>();
  const items: KrishiJagranListingItem[] = [];
  for (const match of html.matchAll(anchorPattern)) {
    const [, attrs, href, inner] = match;
    const url = new URL(href, baseUrl);
    url.search = '';
    url.hash = '';
    const key = url.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    const title = decodeHtmlEntities(readAttr(attrs, 'title') ?? inner.replace(/<[^>]*>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    if (!title) continue;
    const imageUrl = readAttr(inner, 'data-src') ?? readAttr(inner, 'src');
    items.push({ url: key, title, imageUrl: imageUrl ? stripQuery(imageUrl) : undefined });
  }
  return {
    items,
    categoryId: html.match(/var\s+c\s*=\s*(\d+)/)?.[1],
    lastId: html.match(/var\s+l\s*=\s*(\d+)/)?.[1],
  };
};

const findNewsArticleLd = (html: string): Record<string, unknown> | undefined => {
  for (const match of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(match[1]) as unknown;
      const blocks = Array.isArray(parsed) ? parsed : [parsed];
      for (const block of blocks) {
        const record = block as Record<string, unknown>;
        if (record?.['@type'] === 'NewsArticle') return record;
      }
    } catch {
      // Some ld+json blocks on the site are not strictly valid JSON; skip them.
    }
  }
  return undefined;
};

/**
 * Extracts the article body and metadata from a Krishi Jagran story page.
 * The body lives inside `<article>` as `<p>` paragraphs (figures, in-article
 * ad slots and the "first published" footer are ignored). Headline,
 * description, image and dates come from the NewsArticle ld+json block with
 * meta-tag fallbacks.
 */
export const parseKrishiJagranArticle = (html: string): KrishiJagranArticle => {
  const ld = findNewsArticleLd(html);
  const ldImage = ld?.image as { url?: string } | string | undefined;

  const title =
    decodeHtmlEntities(
      (typeof ld?.headline === 'string' ? ld.headline : undefined) ??
        readAttr(html.match(/<h1\b[^>]*>/i)?.[0] ?? '', 'title') ??
        html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i)?.[1] ??
        '',
    ).trim() || undefined;

  const summary =
    decodeHtmlEntities(
      (typeof ld?.description === 'string' ? ld.description : undefined) ??
        html.match(
          /<meta[^>]*(?:property=["']og:description["']|name=["']description["'])[^>]*content=["']([^"']*)["']/i,
        )?.[1] ??
        '',
    ).trim() || undefined;

  const imageUrl =
    (typeof ldImage === 'string' ? ldImage : ldImage?.url) ??
    html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i)?.[1];

  const publishedRaw = typeof ld?.datePublished === 'string' ? ld.datePublished : undefined;
  // The site emits offsets like "+5:30"; pad to a valid ISO "+05:30".
  const publishedAt = publishedRaw
    ? new Date(publishedRaw.replace(/([+-])(\d):(\d\d)$/, '$10$2:$3'))
    : undefined;

  const articleInner = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? '';
  const paragraphs = [...articleInner.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi)].map((m) => m[0]);
  const content = paragraphs.length ? paragraphs.join('\n') : articleInner || undefined;

  return {
    title,
    summary,
    imageUrl,
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined,
    content,
  };
};

export type KrishiJagranAdapterOptions = {
  /** Site origin. Defaults to https://krishijagran.com */
  baseUrl?: string;
  /** Category listing path. Defaults to /commodity-news */
  categoryPath?: string;
  /**
   * Listing pages to walk per run. Page 1 is the rendered HTML; pages 2+ come
   * from /api/MoreStories. Defaults to 1.
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
 * Collects posts from a Krishi Jagran category listing (default: commodity
 * news). The first page is scraped from HTML; further pages come from the
 * site's /api/MoreStories JSON endpoint that powers the "View More" button.
 * Each story page is then fetched for its body text and NewsArticle metadata.
 * Posts are emitted as WEBSITE adapter input; the ingestion service applies
 * normalization, dedup on sourceItemId/canonicalUrl, and keeps everything as
 * DRAFT unless overridden.
 */
export class KrishiJagranAdapter implements WebsiteIngestionAdapter {
  readonly source = 'WEBSITE' as const;

  constructor(private readonly options: KrishiJagranAdapterOptions = {}) {}

  private sourceItemId(url: string): string {
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop() ?? url;
    return `krishijagran-${slug}`;
  }

  private async fetchArticle(url: string, fetchImpl: typeof fetch) {
    const response = await fetchImpl(url);
    if (!response.ok) {
      throw new Error(`article request failed with ${response.status} for ${url}`);
    }
    return parseKrishiJagranArticle(await response.text());
  }

  /**
   * Fetches one story page and yields the mapped input. Returns false when the
   * story predates the `after` bound — listings are newest-first, so the caller
   * stops collecting entirely.
   */
  private async *emitItem(
    item: KrishiJagranListingItem,
    fetchImpl: typeof fetch,
  ): AsyncGenerator<AdapterInput, boolean> {
    const article = await this.fetchArticle(item.url, fetchImpl).catch((error) => {
      console.warn(
        `KrishiJagran article skipped for ${item.url}: ${
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
      summary: article.summary ?? item.description,
      imageUrl: article.imageUrl ?? item.imageUrl,
      externalRedirectUrl: item.url,
      translations: [{ locale: 'en-IN', title: article.title, content: article.content }],
      categoryKeys: this.options.categoryKeys ?? ['market-prices'],
      locationKeys: this.options.locationKeys ?? ['india'],
      discoveredAt: now,
      fetchedAt: now,
      crawlerName: 'krishijagran-html',
      crawlerVersion: '1',
      initialStatus: this.options.initialStatus ?? 'DRAFT',
    };
    return true;
  }

  async *collect(): AsyncIterable<unknown> {
    const {
      baseUrl = 'https://krishijagran.com',
      categoryPath = '/commodity-news',
      maxPages = 1,
      delayMs = 1000,
      fetchImpl = fetch,
    } = this.options;

    const listingUrl = new URL(categoryPath, baseUrl);
    const listingResponse = await fetchImpl(listingUrl);
    if (!listingResponse.ok) {
      throw new Error(
        `KrishiJagran listing failed with ${listingResponse.status} for ${listingUrl.toString()}`,
      );
    }
    const listing = parseKrishiJagranListing(await listingResponse.text(), categoryPath, baseUrl);
    for (const item of listing.items) {
      if (delayMs > 0) await sleep(delayMs);
      if (!(yield* this.emitItem(item, fetchImpl))) return;
    }

    let { lastId } = listing;
    const { categoryId } = listing;
    for (let page = 2; page <= maxPages && categoryId && lastId; page += 1) {
      if (delayMs > 0) await sleep(delayMs);
      const apiUrl = new URL('/api/MoreStories', baseUrl);
      apiUrl.searchParams.set('c', categoryId);
      apiUrl.searchParams.set('l', lastId);
      const response = await fetchImpl(apiUrl);
      if (!response.ok) {
        throw new Error(
          `KrishiJagran MoreStories failed with ${response.status} for ${apiUrl.toString()}`,
        );
      }
      const data = (await response.json()) as { n?: MoreStoriesStory[]; isLast?: boolean };
      const stories = Array.isArray(data?.n) ? data.n : [];
      for (const story of stories) {
        if (delayMs > 0) await sleep(delayMs);
        const proceed = yield* this.emitItem(
          {
            url: story.Url,
            title: decodeHtmlEntities(story.Title ?? '').trim(),
            imageUrl: story.CoverImage,
            description: story.Desc,
          },
          fetchImpl,
        );
        if (!proceed) return;
      }
      if (!stories.length || data.isLast) return;
      lastId = String(stories[stories.length - 1].Id);
    }
  }
}
