export type FeedFilters = {
  locale: string;
  locationId?: string;
  categoryId?: string;
  cursor?: string;
  limit: number;
};

export type PageInfo = {
  nextCursor?: string;
  hasNextPage: boolean;
};

export type FeedResponseDto<T> = {
  items: T[];
  pageInfo: PageInfo;
};
