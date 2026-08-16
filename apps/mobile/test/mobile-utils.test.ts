import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFeedQuery } from '../src/utils/feed.js';
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
