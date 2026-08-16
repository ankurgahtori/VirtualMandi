import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeBlogPostInput } from '../src/normalize.js';

const validInput = {
  source: 'WEBSITE',
  sourceItemId: ' item-1 ',
  canonicalUrl: 'https://example.com/story#tracking',
  translations: [
    { locale: 'en', title: '  Wheat <b>update</b> ', content: '<p>Fresh prices</p>' },
    { locale: 'hi-IN', title: 'गेहूं अपडेट', content: 'आज के भाव' },
  ],
  categoryKeys: [' Market-Prices ', 'market-prices'],
  locationKeys: [' INDIA '],
};

test('normalizes aliases, whitespace, HTML, URLs, and keys', () => {
  const result = normalizeBlogPostInput(validInput);
  assert.equal(result.sourceItemId, 'item-1');
  assert.equal(result.canonicalUrl, 'https://example.com/story');
  assert.equal(result.translations[0].locale, 'en-IN');
  assert.equal(result.translations[0].title, 'Wheat update');
  assert.equal(result.translations[0].content, 'Fresh prices');
  assert.deepEqual(result.categoryKeys, ['market-prices']);
  assert.deepEqual(result.locationKeys, ['india']);
});

test('rejects unsafe URLs and inputs without stable identity', () => {
  assert.throws(() =>
    normalizeBlogPostInput({ ...validInput, canonicalUrl: 'javascript:alert(1)' }),
  );
  assert.throws(() =>
    normalizeBlogPostInput({ ...validInput, sourceItemId: undefined, canonicalUrl: undefined }),
  );
});

test('requires English translation after locale normalization', () => {
  assert.throws(() =>
    normalizeBlogPostInput({
      ...validInput,
      translations: [{ locale: 'hi', title: 'शीर्षक', content: 'सामग्री' }],
    }),
  );
});
