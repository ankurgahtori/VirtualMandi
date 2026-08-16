import assert from 'node:assert/strict';
import test from 'node:test';
import {
  blogPostCreateSchema,
  feedQuerySchema,
  getIstDateKey,
  getMessage,
  normalizedBlogPostInputSchema,
  publishableBlogPostSchema,
} from '../src/index.js';

test('requires an English translation before publishing', () => {
  const result = publishableBlogPostSchema.safeParse({
    type: 'BLOG_POST',
    source: 'MANUAL',
    categoryIds: [],
    locationIds: [],
    translations: [{ locale: 'hi-IN', title: 'शीर्षक', content: 'सामग्री' }],
  });
  assert.equal(result.success, false);
});

test('accepts a valid BlogPost create input', () => {
  const result = blogPostCreateSchema.parse({
    type: 'BLOG_POST',
    source: 'WEBSITE',
    externalRedirectUrl: 'https://example.com/agri-story',
    categoryIds: ['crops'],
    locationIds: ['mh'],
    translations: [{ locale: 'en-IN', title: 'Wheat prices', content: 'Market update' }],
  });
  assert.equal(result.type, 'BLOG_POST');
});

test('rejects unsafe external URL schemes', () => {
  const result = blogPostCreateSchema.safeParse({
    type: 'BLOG_POST',
    source: 'MANUAL',
    externalRedirectUrl: 'javascript:alert(1)',
    categoryIds: [],
    locationIds: [],
    translations: [{ locale: 'en-IN', title: 'Title', content: 'Content' }],
  });
  assert.equal(result.success, false);
});

test('defaults feed pagination and locale', () => {
  assert.deepEqual(feedQuerySchema.parse({}), {
    locale: 'en-IN',
    limit: 20,
  });
});

test('falls back to English static text', () => {
  assert.equal(getMessage('hi-IN', 'feed.title'), 'कृषि अपडेट');
  assert.equal(getMessage('hi-IN', 'feed.missing'), 'feed.missing');
  assert.equal(getMessage('unknown', 'common.appName'), 'Virtual Mandi');
});

test('uses IST date boundaries', () => {
  assert.equal(getIstDateKey(new Date('2025-01-01T18:30:00.000Z')), '2025-01-02');
});

test('requires normalized ingestion identity and content', () => {
  const result = normalizedBlogPostInputSchema.safeParse({
    source: 'WEBSITE',
    sourceItemId: 'article-1',
    translations: [{ locale: 'en-IN', title: 'Title', content: 'Content' }],
  });
  assert.equal(result.success, true);
});
