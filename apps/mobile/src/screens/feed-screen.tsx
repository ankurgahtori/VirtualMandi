import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  FlatList,
  Image,
  Linking,
  RefreshControl,
  StyleSheet,
  TextInput,
  Text,
  View,
} from 'react-native';
import type { BlogPostDetailDto, FeedFilters } from '@virtual-mandi/shared';
import { apiClient, ApiError } from '../api/client';
import { useAuth } from '../auth/auth-context';
import { mobileConfig } from '../config/env';
import { defaultFilters, loadFilters, saveFilters } from '../state/filter-state';
import { safeExternalUrl } from '../utils/urls';

const PostCard = ({ post }: { post: BlogPostDetailDto }) => {
  const openSource = async () => {
    const url = safeExternalUrl(post.externalRedirectUrl);
    if (url && (await Linking.canOpenURL(url))) await Linking.openURL(url);
  };
  return (
    <View style={styles.card} accessible accessibilityLabel={post.title}>
      {post.image?.url ? (
        <Image
          accessibilityLabel={post.title}
          source={{ uri: post.image.url }}
          style={styles.image}
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text>🌾</Text>
        </View>
      )}
      <Text style={styles.title}>{post.title}</Text>
      <Text style={styles.meta}>
        {post.source} · {new Date(post.createdAt).toLocaleDateString()}
      </Text>
      <Text style={styles.content}>{post.content}</Text>
      {safeExternalUrl(post.externalRedirectUrl) ? (
        <Button title="Open source link" onPress={openSource} />
      ) : null}
    </View>
  );
};

export const FeedScreen = () => {
  const { logout } = useAuth();
  const [filters, setFilters] = useState<FeedFilters>({
    ...defaultFilters,
    locale: mobileConfig.defaultLocale,
  });
  const [items, setItems] = useState<BlogPostDetailDto[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const [showFilters, setShowFilters] = useState(false);
  const [draftLocationId, setDraftLocationId] = useState('');
  const [draftCategoryId, setDraftCategoryId] = useState('');

  const load = useCallback(
    async (nextFilters: FeedFilters, append = false) => {
      setError(undefined);
      if (!append) setLoading(true);
      try {
        const response = await apiClient.feed({
          ...nextFilters,
          ...(append && cursor ? { cursor } : {}),
        });
        setItems((current) =>
          append
            ? [
                ...current,
                ...response.items.filter(
                  (item) => !current.some((existing) => existing.id === item.id),
                ),
              ]
            : response.items,
        );
        setCursor(response.pageInfo.nextCursor);
        setHasNext(response.pageInfo.hasNextPage);
        await saveFilters(nextFilters);
      } catch (reason) {
        if (reason instanceof ApiError && reason.status === 401) await logout();
        else setError(reason instanceof Error ? reason.message : 'Could not load updates');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cursor, logout],
  );

  useEffect(() => {
    load(filters);
  }, [filters, load]);
  useEffect(() => {
    loadFilters().then(setFilters);
  }, []);

  const toggleLocale = () =>
    setFilters((current) => ({
      ...current,
      locale: current.locale === 'en-IN' ? 'hi-IN' : 'en-IN',
      cursor: undefined,
    }));
  if (loading && !items.length)
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text>Loading updates…</Text>
      </View>
    );
  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <Button title={filters.locale === 'en-IN' ? 'हिंदी' : 'English'} onPress={toggleLocale} />
        <Button title="Filters" onPress={() => setShowFilters((current) => !current)} />
        <Button title="Log out" onPress={logout} />
      </View>
      {showFilters ? (
        <View style={styles.filters}>
          <TextInput
            accessibilityLabel="Location ID"
            placeholder="Location ID"
            value={draftLocationId}
            onChangeText={setDraftLocationId}
            style={styles.filterInput}
          />
          <TextInput
            accessibilityLabel="Category ID"
            placeholder="Category ID"
            value={draftCategoryId}
            onChangeText={setDraftCategoryId}
            style={styles.filterInput}
          />
          <Button
            title="Apply filters"
            onPress={() => {
              setCursor(undefined);
              setFilters((current) => ({
                ...current,
                locationId: draftLocationId || undefined,
                categoryId: draftCategoryId || undefined,
                cursor: undefined,
              }));
              setShowFilters(false);
            }}
          />
          <Button
            title="Clear filters"
            onPress={() => {
              setDraftLocationId('');
              setDraftCategoryId('');
              setCursor(undefined);
              setFilters((current) => ({
                ...current,
                locationId: undefined,
                categoryId: undefined,
                cursor: undefined,
              }));
            }}
          />
        </View>
      ) : null}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <Button title="Retry" onPress={() => load(filters)} />
        </View>
      ) : null}
      {!items.length && !error ? (
        <View style={styles.center}>
          <Text>No updates available</Text>
          <Button title="Retry" onPress={() => load(filters)} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PostCard post={item} />}
          pagingEnabled
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                setCursor(undefined);
                load(filters);
              }}
            />
          }
          onEndReached={() => {
            if (hasNext && !loading) load(filters, true);
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loading ? <ActivityIndicator /> : null}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f2' },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#fff',
  },
  filters: { gap: 8, padding: 12, backgroundColor: '#fff' },
  filterInput: { borderWidth: 1, borderColor: '#c8d2c5', borderRadius: 8, padding: 10 },
  card: {
    margin: 12,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
  },
  image: { width: '100%', height: 220, backgroundColor: '#e8f5e9' },
  imagePlaceholder: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f5e9',
  },
  title: { paddingHorizontal: 16, paddingTop: 16, fontSize: 22, fontWeight: '700' },
  meta: { paddingHorizontal: 16, paddingTop: 6, color: '#687268', fontSize: 12 },
  content: { padding: 16, fontSize: 16, lineHeight: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorBox: { padding: 12, backgroundColor: '#ffebee' },
  error: { color: '#b3261e', textAlign: 'center' },
});
