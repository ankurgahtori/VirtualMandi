import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FeedFilters } from '@virtual-mandi/shared';

const FILTERS_KEY = 'virtual-mandi.feed-filters';
export const defaultFilters: FeedFilters = { locale: 'en-IN', limit: 10 };

export const loadFilters = async (): Promise<FeedFilters> => {
  const saved = await AsyncStorage.getItem(FILTERS_KEY);
  if (!saved) return defaultFilters;
  try {
    return { ...defaultFilters, ...(JSON.parse(saved) as Partial<FeedFilters>) };
  } catch {
    return defaultFilters;
  }
};

export const saveFilters = (filters: FeedFilters) =>
  AsyncStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
