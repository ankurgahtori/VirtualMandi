export type SyncCategoryStatusDto = {
  id: string;
  label: string;
  listingUrl: string;
  categoryKey?: string;
  categoryName?: string;
  locationKey?: string;
  postCount: number;
  lastFetchedAt?: string;
  lastSyncedAt?: string;
  syncing: boolean;
};

export type SyncSourceStatusDto = {
  id: string;
  domain: string;
  label: string;
  adapterKey: string;
  isActive: boolean;
  categories: SyncCategoryStatusDto[];
};

export type IngestionAdapterDto = {
  key: string;
  label: string;
};

export type TaxonomyOptionDto = {
  id: string;
  key: string;
  name: string;
};

export type SyncSourcesResponseDto = {
  items: SyncSourceStatusDto[];
  adapters: IngestionAdapterDto[];
  feedCategories: TaxonomyOptionDto[];
  locations: TaxonomyOptionDto[];
};

export type IngestionSyncResultDto = {
  accepted: number;
  created: number;
  updated: number;
  duplicate: number;
  rejected: number;
  errors: Array<{ index: number; message: string }>;
};
