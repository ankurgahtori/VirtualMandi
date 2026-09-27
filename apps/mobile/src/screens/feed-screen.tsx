import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Button,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  TextInput,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import type { BlogPostDetailDto, FeedFilters } from '@virtual-mandi/shared';
import { apiClient, ApiError } from '../api/client';
import { useAuth } from '../auth/auth-context';
import { mobileConfig } from '../config/env';
import { defaultFilters, loadFilters, saveFilters } from '../state/filter-state';
import { useLocale } from '../state/locale-context';
import { postExcerpt } from '../utils/text';
import { resolveMediaUrl, safeExternalUrl } from '../utils/urls';

const PostCard = ({ post }: { post: BlogPostDetailDto }) => {
  const [webUrl, setWebUrl] = useState<string>();
  const sourceUrl = safeExternalUrl(post.externalRedirectUrl);
  return (
    <Pressable
      style={styles.card}
      accessible
      accessibilityLabel={post.title}
      accessibilityRole={sourceUrl ? 'link' : undefined}
      onPress={sourceUrl ? () => setWebUrl(sourceUrl) : undefined}
    >
      {post.image?.url ? (
        <Image
          accessibilityLabel={post.title}
          source={{ uri: resolveMediaUrl(post.image.url) }}
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
      <Text style={styles.content}>{postExcerpt(post)}</Text>
      <Modal
        animationType="slide"
        visible={webUrl !== undefined}
        onRequestClose={() => setWebUrl(undefined)}
      >
        <View style={styles.webContainer}>
          <View style={styles.webHeader}>
            <Pressable
              accessibilityLabel="Close"
              hitSlop={12}
              onPress={() => setWebUrl(undefined)}
              style={styles.webClose}
            >
              <Ionicons name="close" size={24} color="#3c4a3c" />
            </Pressable>
            <Text numberOfLines={1} style={styles.webUrl}>
              {webUrl}
            </Text>
          </View>
          {webUrl ? (
            <WebView
              style={styles.webView}
              source={{ uri: webUrl }}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.center}>
                  <ActivityIndicator />
                </View>
              )}
            />
          ) : null}
        </View>
      </Modal>
    </Pressable>
  );
};

const CARD_HEIGHT = Dimensions.get('window').height;
const SWIPE_THRESHOLD = CARD_HEIGHT * 0.35;

export const FeedScreen = () => {
  const { logout } = useAuth();
  const { locale, setLocale } = useLocale();
  const [filters, setFilters] = useState<FeedFilters>({
    ...defaultFilters,
    locale: mobileConfig.defaultLocale,
  });
  const [items, setItems] = useState<BlogPostDetailDto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
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

  useEffect(() => {
    setFilters((current) =>
      current.locale === locale ? current : { ...current, locale, cursor: undefined },
    );
  }, [locale]);

  const toggleLocale = () => setLocale(locale === 'en-IN' ? 'hi-IN' : 'en-IN');

  useEffect(() => {
    if (currentIndex >= items.length && items.length) setCurrentIndex(items.length - 1);
  }, [currentIndex, items.length]);

  const advanceCard = useCallback(async () => {
    if (currentIndex + 1 < items.length) {
      setCurrentIndex((index) => index + 1);
      return;
    }
    if (hasNext && !loading) {
      await load(filters, true);
      setCurrentIndex((index) => index + 1);
    }
  }, [currentIndex, filters, hasNext, items.length, load, loading]);

  const retreatCard = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex((index) => index - 1);
  }, [currentIndex]);

  const cardY = useRef(new Animated.Value(0)).current;
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => {
          const canAdvance = currentIndex + 1 < items.length || (hasNext && !loading);
          const canRetreat = currentIndex > 0;
          if (gesture.dy < 0 && !canAdvance) return false;
          if (gesture.dy > 0 && !canRetreat) return false;
          return Math.abs(gesture.dy) > 8;
        },
        onPanResponderMove: (_event, gesture) => {
          const canAdvance = currentIndex + 1 < items.length || (hasNext && !loading);
          const canRetreat = currentIndex > 0;
          if ((gesture.dy < 0 && !canAdvance) || (gesture.dy > 0 && !canRetreat)) {
            cardY.setValue(0);
            return;
          }
          cardY.setValue(Math.max(-CARD_HEIGHT, Math.min(CARD_HEIGHT, gesture.dy)));
        },
        onPanResponderRelease: (_event, gesture) => {
          const canAdvance = currentIndex + 1 < items.length || (hasNext && !loading);
          const canRetreat = currentIndex > 0;
          const target =
            gesture.dy < -SWIPE_THRESHOLD && canAdvance
              ? -CARD_HEIGHT
              : gesture.dy > SWIPE_THRESHOLD && canRetreat
                ? CARD_HEIGHT
                : 0;

          if (target === 0) {
            const attemptedInvalidDirection =
              (gesture.dy < 0 && !canAdvance) || (gesture.dy > 0 && !canRetreat);
            if (attemptedInvalidDirection) {
              cardY.setValue(0);
            } else {
              Animated.spring(cardY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 70,
                friction: 9,
              }).start();
            }
            return;
          }

          Animated.timing(cardY, {
            toValue: target,
            duration: 240,
            useNativeDriver: true,
          }).start(async () => {
            if (target < 0) {
              const hasLoadedNextCard = currentIndex + 1 < items.length;
              if (hasLoadedNextCard) cardY.setValue(0);
              await advanceCard();
              if (!hasLoadedNextCard) cardY.setValue(0);
            } else {
              // The previous card has already reached the active position
              // underneath, so reveal it without a second entrance animation.
              cardY.setValue(0);
              retreatCard();
            }
          });
        },
        onPanResponderTerminate: () => {
          Animated.spring(cardY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 70,
            friction: 9,
          }).start();
        },
      }),
    [advanceCard, cardY, currentIndex, hasNext, items.length, loading, retreatCard],
  );

  const previousPost = items[currentIndex - 1];
  const currentPost = items[currentIndex];
  const nextPost = items[currentIndex + 1];
  const activeCardStyle = {
    transform: [
      {
        translateY: cardY.interpolate({
          inputRange: [-CARD_HEIGHT, 0, CARD_HEIGHT],
          outputRange: [-CARD_HEIGHT, 0, 0],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: cardY.interpolate({
          inputRange: [-CARD_HEIGHT, 0, CARD_HEIGHT],
          outputRange: [0.98, 1, 0.92],
          extrapolate: 'clamp',
        }),
      },
    ],
    opacity: 1,
  };
  const nextCardStyle = {
    opacity: cardY.interpolate({
      inputRange: [-CARD_HEIGHT, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: cardY.interpolate({
          inputRange: [-CARD_HEIGHT, 0],
          outputRange: [0, 0],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: cardY.interpolate({
          inputRange: [-CARD_HEIGHT, 0],
          outputRange: [1, 0.9],
          extrapolate: 'clamp',
        }),
      },
    ],
  };
  const previousCardStyle = {
    opacity: 1,
    transform: [
      {
        translateY: cardY.interpolate({
          inputRange: [0, CARD_HEIGHT * 0.35],
          outputRange: [-CARD_HEIGHT, 0],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: cardY.interpolate({
          inputRange: [0, CARD_HEIGHT * 0.35],
          outputRange: [1, 1],
          extrapolate: 'clamp',
        }),
      },
    ],
  };
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
        <Button
          title={refreshing ? 'Refreshing…' : 'Refresh'}
          disabled={refreshing}
          onPress={() => {
            setRefreshing(true);
            setCursor(undefined);
            setCurrentIndex(0);
            load(filters);
          }}
        />
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
        <View style={styles.cardViewport}>
          {nextPost ? (
            <Animated.View pointerEvents="none" style={[styles.stackCard, nextCardStyle]}>
              <PostCard post={nextPost} />
            </Animated.View>
          ) : null}
          {currentPost ? (
            <Animated.View
              {...panResponder.panHandlers}
              style={[styles.stackCard, styles.activeCard, activeCardStyle]}
            >
              <PostCard post={currentPost} />
              <Text style={styles.swipeHint}>Swipe up for next · pull down for previous</Text>
            </Animated.View>
          ) : null}
          {previousPost ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.stackCard, styles.previousCard, previousCardStyle]}
            >
              <PostCard post={previousPost} />
            </Animated.View>
          ) : null}
          {loading ? <ActivityIndicator style={styles.paginationLoader} /> : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f2' },
  cardViewport: { flex: 1, overflow: 'hidden' },
  stackCard: { ...StyleSheet.absoluteFillObject, margin: 12 },
  activeCard: { zIndex: 2 },
  previousCard: { zIndex: 3 },
  swipeHint: { textAlign: 'center', color: '#687268', paddingBottom: 8 },
  paginationLoader: { margin: 8 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#fff',
  },
  filters: { gap: 8, padding: 12, backgroundColor: '#fff' },
  filterInput: { borderWidth: 1, borderColor: '#c8d2c5', borderRadius: 8, padding: 10 },
  card: {
    flex: 1,
    margin: 0,
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
  webContainer: { flex: 1, backgroundColor: '#fff' },
  webView: { flex: 1 },
  webHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e6dd',
  },
  webClose: { padding: 4 },
  webUrl: { flex: 1, color: '#687268', fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorBox: { padding: 12, backgroundColor: '#ffebee' },
  error: { color: '#b3261e', textAlign: 'center' },
});
