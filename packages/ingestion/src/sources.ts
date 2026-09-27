import type { WebsiteIngestionAdapter } from './adapters.js';
import { AgricultureDiveAdapter } from './agriculturedive.js';
import { BusinessLineAdapter } from './businessline.js';
import { ChiniMandiAdapter } from './chinimandi.js';
import { EconomicTimesAdapter } from './economictimes.js';
import { GenericHtmlAdapter } from './generic-html.js';
import { KrishiJagranAdapter } from './krishijagran.js';
import { LiveMintAdapter } from './livemint.js';
import { RssAdapter } from './rss.js';
import { TheHinduAdapter } from './thehindu.js';
import { WordPressAdapter } from './wordpress.js';

export type IngestionAdapterOptions = {
  /** Listing page URL stored on a SyncSourceCategory row. */
  listingUrl?: string;
  /** Adapter-specific parameters stored on the SyncSourceCategory row. */
  adapterConfig?: Record<string, unknown>;
  categoryKeys?: string[];
  locationKeys?: string[];
  after?: string;
  maxPages?: number;
  /** Defaults to PUBLISHED so admin-triggered syncs mirror the CLIs. */
  initialStatus?: 'DRAFT' | 'PUBLISHED';
};

export type IngestionAdapterDefinition = {
  /** Stable key referenced by SyncSource.adapterKey, e.g. "krishijagran". */
  key: string;
  label: string;
  createAdapter: (options?: IngestionAdapterOptions) => WebsiteIngestionAdapter;
};

const listingOrigin = (listingUrl?: string) =>
  listingUrl ? new URL(listingUrl).origin : undefined;

const listingPath = (listingUrl?: string) =>
  listingUrl ? new URL(listingUrl).pathname : undefined;

const numericConfig = (config: Record<string, unknown> | undefined, key: string) =>
  typeof config?.[key] === 'number' ? (config[key] as number) : undefined;

const stringConfig = (config: Record<string, unknown> | undefined, key: string) =>
  typeof config?.[key] === 'string' ? (config[key] as string) : undefined;

/**
 * Registry of website scraping adapters, keyed by the `adapterKey` stored on
 * SyncSource rows. Which sites and listing pages get synced lives in the
 * database; this registry only maps a key to the code that knows how to read
 * that kind of site. New adapters need one entry here plus a SyncSource row.
 */
export const INGESTION_ADAPTERS: IngestionAdapterDefinition[] = [
  {
    key: 'chinimandi',
    label: 'ChiniMandi — WordPress API',
    createAdapter: (options) =>
      new ChiniMandiAdapter({
        baseUrl: listingOrigin(options?.listingUrl),
        categoryId: numericConfig(options?.adapterConfig, 'categoryId'),
        perPage: numericConfig(options?.adapterConfig, 'perPage'),
        after: options?.after,
        maxPages: options?.maxPages,
        categoryKeys: options?.categoryKeys,
        locationKeys: options?.locationKeys,
        initialStatus: options?.initialStatus ?? 'PUBLISHED',
      }),
  },
  {
    key: 'wordpress',
    label: 'Any WordPress site — WP REST API (adapterConfig: wpCategoryId, contentLocale)',
    createAdapter: (options) => {
      const baseUrl = listingOrigin(options?.listingUrl);
      const categoryId = numericConfig(options?.adapterConfig, 'wpCategoryId');
      if (!baseUrl || categoryId === undefined)
        throw new Error(
          'wordpress adapter requires listingUrl origin and adapterConfig.wpCategoryId',
        );
      return new WordPressAdapter({
        baseUrl,
        categoryId,
        contentLocale: stringConfig(options?.adapterConfig, 'contentLocale'),
        perPage: numericConfig(options?.adapterConfig, 'perPage'),
        after: options?.after,
        maxPages: options?.maxPages,
        categoryKeys: options?.categoryKeys,
        locationKeys: options?.locationKeys,
        initialStatus: options?.initialStatus ?? 'PUBLISHED',
      });
    },
  },
  {
    key: 'generic-html',
    label:
      'Config-driven HTML listing (adapterConfig: articleUrlPattern, bodyMarker?, pageParam?, contentLocale?)',
    createAdapter: (options) => {
      const listingUrl = options?.listingUrl;
      const articleUrlPattern = stringConfig(options?.adapterConfig, 'articleUrlPattern');
      if (!listingUrl || !articleUrlPattern)
        throw new Error(
          'generic-html adapter requires listingUrl and adapterConfig.articleUrlPattern',
        );
      return new GenericHtmlAdapter({
        listingUrl,
        articleUrlPattern,
        bodyMarker: stringConfig(options?.adapterConfig, 'bodyMarker'),
        excludeUrlPattern: stringConfig(options?.adapterConfig, 'excludeUrlPattern'),
        pageParam: stringConfig(options?.adapterConfig, 'pageParam'),
        contentLocale: stringConfig(options?.adapterConfig, 'contentLocale'),
        after: options?.after,
        maxPages: options?.maxPages,
        categoryKeys: options?.categoryKeys,
        locationKeys: options?.locationKeys,
        initialStatus: options?.initialStatus ?? 'PUBLISHED',
      });
    },
  },
  {
    key: 'rss',
    label: 'Any RSS feed — content:encoded or article fetch (adapterConfig: feedUrl)',
    createAdapter: (options) =>
      new RssAdapter({
        listingUrl: options?.listingUrl,
        feedUrl: stringConfig(options?.adapterConfig, 'feedUrl'),
        fetchArticles:
          typeof options?.adapterConfig?.fetchArticles === 'boolean'
            ? options.adapterConfig.fetchArticles
            : undefined,
        maxItems: numericConfig(options?.adapterConfig, 'maxItems'),
        after: options?.after,
        categoryKeys: options?.categoryKeys,
        locationKeys: options?.locationKeys,
        initialStatus: options?.initialStatus ?? 'PUBLISHED',
      }),
  },
  {
    key: 'krishijagran',
    label: 'Krishi Jagran — HTML listing + MoreStories API',
    createAdapter: (options) =>
      new KrishiJagranAdapter({
        baseUrl: listingOrigin(options?.listingUrl),
        categoryPath: listingPath(options?.listingUrl),
        after: options?.after,
        maxPages: options?.maxPages,
        categoryKeys: options?.categoryKeys,
        locationKeys: options?.locationKeys,
        initialStatus: options?.initialStatus ?? 'PUBLISHED',
      }),
  },
  {
    key: 'businessline',
    label: 'The Hindu BusinessLine — HTML listing',
    createAdapter: (options) =>
      new BusinessLineAdapter({
        baseUrl: listingOrigin(options?.listingUrl),
        categoryPath: listingPath(options?.listingUrl),
        after: options?.after,
        maxPages: options?.maxPages,
        categoryKeys: options?.categoryKeys,
        locationKeys: options?.locationKeys,
        initialStatus: options?.initialStatus ?? 'PUBLISHED',
      }),
  },
  {
    key: 'economictimes',
    label: 'Economic Times — RSS + article pages',
    createAdapter: (options) =>
      new EconomicTimesAdapter({
        listingUrl: options?.listingUrl,
        feedUrl: stringConfig(options?.adapterConfig, 'feedUrl'),
        after: options?.after,
        categoryKeys: options?.categoryKeys,
        locationKeys: options?.locationKeys,
        initialStatus: options?.initialStatus ?? 'PUBLISHED',
      }),
  },
  {
    key: 'livemint',
    label: 'Mint — HTML listing (page 1 only)',
    createAdapter: (options) =>
      new LiveMintAdapter({
        baseUrl: listingOrigin(options?.listingUrl),
        categoryPath: listingPath(options?.listingUrl),
        after: options?.after,
        categoryKeys: options?.categoryKeys,
        locationKeys: options?.locationKeys,
        initialStatus: options?.initialStatus ?? 'PUBLISHED',
      }),
  },
  {
    key: 'agriculturedive',
    label: 'Agriculture Dive — HTML listing',
    createAdapter: (options) =>
      new AgricultureDiveAdapter({
        listingUrl: options?.listingUrl,
        after: options?.after,
        maxPages: options?.maxPages,
        categoryKeys: options?.categoryKeys,
        locationKeys: options?.locationKeys,
        initialStatus: options?.initialStatus ?? 'PUBLISHED',
      }),
  },
  {
    key: 'thehindu',
    label: 'The Hindu — topic listing',
    createAdapter: (options) =>
      new TheHinduAdapter({
        listingUrl: options?.listingUrl,
        after: options?.after,
        maxPages: options?.maxPages,
        categoryKeys: options?.categoryKeys,
        locationKeys: options?.locationKeys,
        initialStatus: options?.initialStatus ?? 'PUBLISHED',
      }),
  },
];

export const findIngestionAdapter = (key: string) =>
  INGESTION_ADAPTERS.find((adapter) => adapter.key === key);
