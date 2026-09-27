import assert from 'node:assert/strict';
import test from 'node:test';
import { findIngestionAdapter, INGESTION_ADAPTERS } from '../src/sources.js';

test('registry resolves adapters by key', () => {
  const keys = INGESTION_ADAPTERS.map((adapter) => adapter.key);
  assert.deepEqual(keys, [
    'chinimandi',
    'wordpress',
    'generic-html',
    'rss',
    'krishijagran',
    'businessline',
    'economictimes',
    'livemint',
    'agriculturedive',
    'thehindu',
  ]);

  const adapter = findIngestionAdapter('krishijagran');
  assert.ok(adapter);
  const instance = adapter.createAdapter({ initialStatus: 'DRAFT' });
  assert.equal(instance.source, 'WEBSITE');
  assert.equal(typeof instance.collect, 'function');
});

test('listingUrl drives adapter targeting', () => {
  const adapter = findIngestionAdapter('krishijagran');
  assert.ok(adapter);
  // Should not throw; the pathname becomes the adapter's categoryPath.
  const instance = adapter.createAdapter({
    listingUrl: 'https://krishijagran.com/industry-news',
    initialStatus: 'DRAFT',
  });
  assert.equal(instance.source, 'WEBSITE');
});

test('unknown adapter keys do not resolve', () => {
  assert.equal(findIngestionAdapter('example.com'), undefined);
});
