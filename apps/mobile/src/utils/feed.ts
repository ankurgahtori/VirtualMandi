import type { FeedFilters } from '@virtual-mandi/shared';

export const buildFeedQuery = (filters: FeedFilters) => {
  const query = new URLSearchParams({ locale: filters.locale, limit: String(filters.limit) });
  if (filters.locationId) query.set('locationId', filters.locationId);
  if (filters.categoryId) query.set('categoryId', filters.categoryId);
  if (filters.cursor) query.set('cursor', filters.cursor);
  return query.toString();
};
