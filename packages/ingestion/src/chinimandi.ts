import type { AdapterInput, WebsiteIngestionAdapter } from './adapters.js';

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  deg: '°',
  times: '×',
  copy: '©',
  reg: '®',
  trade: '™',
};

export const decodeHtmlEntities = (value: string): string =>
  value.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const hex = entity[1] === 'x' || entity[1] === 'X';
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });

type WpRenderedField = { rendered?: string };

type WpPost = {
  id: number;
  link: string;
  title?: WpRenderedField;
  content?: WpRenderedField;
  excerpt?: WpRenderedField;
  _embedded?: { 'wp:featuredmedia'?: Array<{ source_url?: string }> };
};

export type ChiniMandiAdapterOptions = {
  /** Site origin. Defaults to https://www.chinimandi.com */
  baseUrl?: string;
  /** WordPress category id. 14 = "Indian Sugar News in Hindi". */
  categoryId?: number;
  /** Posts per page (WP max is 100). Defaults to 10. */
  perPage?: number;
  /** Pages to walk per run. Defaults to 1. */
  maxPages?: number;
  /** ISO 8601 lower bound on publish date, maps to the WP `after` filter. */
  after?: string;
  /** Pause between page requests. Defaults to 1000ms; pass 0 in tests. */
  delayMs?: number;
  categoryKeys?: string[];
  locationKeys?: string[];
  /** Defaults to DRAFT; pass PUBLISHED only for a trusted direct-publish run. */
  initialStatus?: 'DRAFT' | 'PUBLISHED';
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const CHINIMANDI_INDIAN_SUGAR_NEWS_HINDI_CATEGORY_ID = 14;

/**
 * Collects posts from the public ChiniMandi WordPress REST API. The default
 * category is the Hindi "Indian Sugar News" listing the product asked to
 * mirror daily. Posts are emitted as WEBSITE adapter input; the ingestion
 * service applies normalization, dedup on sourceItemId/canonicalUrl, and
 * keeps everything as DRAFT.
 */
export class ChiniMandiAdapter implements WebsiteIngestionAdapter {
  readonly source = 'WEBSITE' as const;

  constructor(private readonly options: ChiniMandiAdapterOptions = {}) {}

  private mapPost(post: WpPost): AdapterInput {
    const now = (this.options.now?.() ?? new Date()).toISOString();
    const title = decodeHtmlEntities(post.title?.rendered ?? '');
    const content = decodeHtmlEntities(post.content?.rendered || post.excerpt?.rendered || '');
    const imageUrl = post._embedded?.['wp:featuredmedia']?.[0]?.source_url;
    return {
      source: this.source,
      sourceItemId: `chinimandi-${post.id}`,
      canonicalUrl: post.link,
      summary: decodeHtmlEntities(post.excerpt?.rendered ?? '') || undefined,
      imageUrl,
      externalRedirectUrl: post.link,
      // The site only publishes a Hindi body here; the en-IN entry mirrors it
      // so the required English fallback stays readable until translated.
      translations: [
        { locale: 'hi-IN', title, content },
        { locale: 'en-IN', title, content },
      ],
      categoryKeys: this.options.categoryKeys ?? ['news'],
      locationKeys: this.options.locationKeys ?? ['india'],
      discoveredAt: now,
      fetchedAt: now,
      crawlerName: 'chinimandi-wp-api',
      crawlerVersion: '1',
      initialStatus: this.options.initialStatus ?? 'DRAFT',
    };
  }

  async *collect(): AsyncIterable<unknown> {
    const {
      baseUrl = 'https://www.chinimandi.com',
      categoryId = CHINIMANDI_INDIAN_SUGAR_NEWS_HINDI_CATEGORY_ID,
      perPage = 10,
      maxPages = 1,
      after,
      delayMs = 1000,
      fetchImpl = fetch,
    } = this.options;

    for (let page = 1; page <= maxPages; page += 1) {
      const url = new URL('/wp-json/wp/v2/posts', baseUrl);
      url.searchParams.set('categories', String(categoryId));
      url.searchParams.set('per_page', String(perPage));
      url.searchParams.set('page', String(page));
      url.searchParams.set('_embed', '1');
      url.searchParams.set('orderby', 'date');
      url.searchParams.set('order', 'desc');
      if (after) url.searchParams.set('after', after);

      const response = await fetchImpl(url);
      // WordPress answers 400 rest_post_invalid_page_number past the last page.
      if (response.status === 400) return;
      if (!response.ok) {
        throw new Error(`ChiniMandi request failed with ${response.status} for ${url.toString()}`);
      }
      const posts = (await response.json()) as WpPost[];
      if (!Array.isArray(posts) || posts.length === 0) return;
      for (const post of posts) yield this.mapPost(post);
      if (posts.length < perPage || page === maxPages) return;
      if (delayMs > 0) await sleep(delayMs);
    }
  }
}
