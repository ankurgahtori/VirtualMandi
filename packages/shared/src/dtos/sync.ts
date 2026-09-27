export type IngestionSourceStatusDto = {
  /** Hostname posts are grouped under, e.g. "krishijagran.com". */
  domain: string;
  label: string;
  postCount: number;
  lastFetchedAt?: string;
  syncing: boolean;
};

export type IngestionSyncResultDto = {
  accepted: number;
  created: number;
  updated: number;
  duplicate: number;
  rejected: number;
  errors: Array<{ index: number; message: string }>;
};
