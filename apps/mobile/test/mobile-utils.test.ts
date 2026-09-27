import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFeedQuery } from '../src/utils/feed.js';
import { firstWords, postExcerpt } from '../src/utils/text.js';
import { safeExternalUrl } from '../src/utils/urls.js';

test('serializes feed filters and cursor deterministically', () => {
  const query = buildFeedQuery({
    locale: 'hi-IN',
    locationId: 'india',
    categoryId: 'market-prices',
    cursor: 'post-1',
    limit: 10,
  });
  assert.equal(
    query,
    'locale=hi-IN&limit=10&locationId=india&categoryId=market-prices&cursor=post-1',
  );
});

test('allows only http and https external links', () => {
  assert.equal(safeExternalUrl('https://example.com/a'), 'https://example.com/a');
  assert.equal(safeExternalUrl('javascript:alert(1)'), undefined);
  assert.equal(safeExternalUrl(undefined), undefined);
});

test('firstWords truncates to the word limit with an ellipsis', () => {
  const long = Array.from({ length: 40 }, (_, i) => `w${i + 1}`).join(' ');
  const result = firstWords(long);
  assert.equal(result.split('…')[0].trim().split(' ').length, 30);
  assert.ok(result.endsWith('…'));
  assert.equal(firstWords('short text'), 'short text');
});

test('postExcerpt prefers the stored summary over content fallback', () => {
  const post = { summary: '  saved summary  ', content: 'a '.repeat(60) };
  assert.equal(postExcerpt(post), 'saved summary');
  const fallback = postExcerpt({ summary: undefined, content: 'a '.repeat(60) });
  assert.equal(fallback.trim().split(/\s+/).filter(Boolean).length, 30);
  assert.ok(fallback.endsWith('…'));
});
