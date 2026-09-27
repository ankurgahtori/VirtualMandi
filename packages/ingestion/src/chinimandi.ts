import type { AdapterInput } from './adapters.js';
import { decodeHtmlEntities } from './html.js';
import { WordPressAdapter, type WordPressPost } from './wordpress.js';

export { decodeHtmlEntities };

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

export const CHINIMANDI_INDIAN_SUGAR_NEWS_HINDI_CATEGORY_ID = 14;

/**
 * Collects posts from the public ChiniMandi WordPress REST API. The default
 * category is the Hindi "Indian Sugar News" listing the product asked to
 * mirror daily. Posts are emitted as WEBSITE adapter input; the ingestion
 * service applies normalization, dedup on sourceItemId/canonicalUrl, and
 * keeps everything as DRAFT.
 */
export class ChiniMandiAdapter extends WordPressAdapter {
  constructor(options: ChiniMandiAdapterOptions = {}) {
    super({
      ...options,
      baseUrl: options.baseUrl ?? 'https://www.chinimandi.com',
      categoryId: options.categoryId ?? CHINIMANDI_INDIAN_SUGAR_NEWS_HINDI_CATEGORY_ID,
      idPrefix: 'chinimandi',
    });
  }

  protected override mapPost(post: WordPressPost): AdapterInput {
    const input = super.mapPost(post);
    const title = input.translations[0]?.title ?? '';
    const content = input.translations[0]?.content ?? '';
    return {
      ...input,
      // The site only publishes a Hindi body here; the en-IN entry mirrors it
      // so the required English fallback stays readable until translated.
      translations: [
        { locale: 'hi-IN', title, content },
        { locale: 'en-IN', title, content },
      ],
    };
  }
}
