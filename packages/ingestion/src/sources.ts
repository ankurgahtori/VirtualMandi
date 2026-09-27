import type { WebsiteIngestionAdapter } from './adapters.js';
import { ChiniMandiAdapter } from './chinimandi.js';
import { KrishiJagranAdapter } from './krishijagran.js';

export type IngestionSourceOptions = {
  after?: string;
  maxPages?: number;
  /** Defaults to PUBLISHED so admin-triggered syncs mirror the CLIs. */
  initialStatus?: 'DRAFT' | 'PUBLISHED';
};

export type IngestionSourceDefinition = {
  /** Hostname `Post.canonicalUrl` is grouped under, e.g. "krishijagran.com". */
  domain: string;
  label: string;
  createAdapter: (options?: IngestionSourceOptions) => WebsiteIngestionAdapter;
};

/**
 * Registry of syncable website sources, keyed by the canonical hostname of the
 * URLs they produce (no subroutes). The admin API resolves a domain to an
 * adapter from here; new crawlers only need an adapter plus one entry.
 */
export const INGESTION_SOURCES: IngestionSourceDefinition[] = [
  {
    domain: 'www.chinimandi.com',
    label: 'ChiniMandi — Indian sugar news (Hindi)',
    createAdapter: (options) =>
      new ChiniMandiAdapter({
        after: options?.after,
        maxPages: options?.maxPages,
        initialStatus: options?.initialStatus ?? 'PUBLISHED',
      }),
  },
  {
    domain: 'krishijagran.com',
    label: 'Krishi Jagran — Commodity news',
    createAdapter: (options) =>
      new KrishiJagranAdapter({
        after: options?.after,
        maxPages: options?.maxPages,
        initialStatus: options?.initialStatus ?? 'PUBLISHED',
      }),
  },
];

export const findIngestionSourceByDomain = (domain: string) =>
  INGESTION_SOURCES.find((source) => source.domain === domain);
