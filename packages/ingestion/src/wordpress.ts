import type { AdapterInput, WebsiteIngestionAdapter } from './adapters.js';
import { decodeHtmlEntities, sleep } from './html.js';

type WpRenderedField = { rendered?: string };

export type WordPressPost = {
  id: number;
  link: string;
  title?: WpRenderedField;
  content?: WpRenderedField;
  excerpt?: WpRenderedField;
  _embedded?: { 'wp:featuredmedia'?: Array<{ source_url?: string }> };
};

export type WordPressAdapterOptions = {
  /** Site origin — the SyncSource domain (e.g. https://emandirates.com). */
  baseUrl: string;
  /** WordPress category id (SyncSourceCategory.adapterConfig.wpCategoryId). */
  categoryId: number;
  /** sourceItemId prefix + crawlerName segment; defaults to a hostname slug. */
  idPrefix?: string;
  /** Posts per page (WP max is 100). Defaults to 10. */
  perPage?: number;
  /** Pages to walk per run. Defaults to 1. */
  maxPages?: number;
  /** ISO 8601 lower bound on publish date, maps to the WP `after` filter. */
  after?: string;
  /** Pause between page requests. Defaults to 1000ms; pass 0 in tests. */
  delayMs?: number;
  /**
   * Locale of the site's content (default 'en-IN'). When not en-IN, the en-IN
   * translation mirrors the content so the mandatory English fallback exists.
   */
  contentLocale?: string;
  categoryKeys?: string[];
  locationKeys?: string[];
  /** Defaults to DRAFT; pass PUBLISHED only for a trusted direct-publish run. */
  initialStatus?: 'DRAFT' | 'PUBLISHED';
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

/**
 * Generic WordPress REST adapter (`/wp-json/wp/v2/posts?categories=<id>`).
 * Any site exposing the WP API can be onboarded with a SyncSource +
 * SyncSourceCategory (`adapterConfig: {"wpCategoryId": <n>}`) and no code —
 * the admin sync page and sync-cli drive it through the `wordpress` key.
 */
export class WordPressAdapter implements WebsiteIngestionAdapter {
  readonly source = 'WEBSITE' as const;

  constructor(private readonly options: WordPressAdapterOptions) {}

  protected idPrefix(): string {
    if (this.options.idPrefix) return this.options.idPrefix;
    return this.options.baseUrl
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\./g, '-')
      .replace(/\/.*$/, '');
  }

  protected mapPost(post: WordPressPost): AdapterInput {
    const now = (this.options.now?.() ?? new Date()).toISOString();
    const title = decodeHtmlEntities(post.title?.rendered ?? '');
    const content = decodeHtmlEntities(post.content?.rendered || post.excerpt?.rendered || '');
    const imageUrl = post._embedded?.['wp:featuredmedia']?.[0]?.source_url;
    const contentLocale = this.options.contentLocale ?? 'en-IN';
    const translations =
      contentLocale === 'en-IN'
        ? [{ locale: 'en-IN', title, content }]
        : [
            { locale: contentLocale, title, content },
            { locale: 'en-IN', title, content },
          ];
    return {
      source: this.source,
      sourceItemId: `${this.idPrefix()}-${post.id}`,
      canonicalUrl: post.link,
      summary: decodeHtmlEntities(post.excerpt?.rendered ?? '') || undefined,
      imageUrl,
      externalRedirectUrl: post.link,
      translations,
      categoryKeys: this.options.categoryKeys ?? ['news'],
      locationKeys: this.options.locationKeys ?? ['india'],
      discoveredAt: now,
      fetchedAt: now,
      crawlerName: `${this.idPrefix()}-wp-api`,
      crawlerVersion: '1',
      initialStatus: this.options.initialStatus ?? 'DRAFT',
    };
  }

  async *collect(): AsyncIterable<unknown> {
    const {
      baseUrl,
      categoryId,
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
        throw new Error(`WordPress request failed with ${response.status} for ${url.toString()}`);
      }
      const posts = (await response.json()) as WordPressPost[];
      if (!Array.isArray(posts) || posts.length === 0) return;
      for (const post of posts) yield this.mapPost(post);
      if (posts.length < perPage || page === maxPages) return;
      if (delayMs > 0) await sleep(delayMs);
    }
  }
}
