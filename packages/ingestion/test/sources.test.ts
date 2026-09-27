import assert from 'node:assert/strict';
import test from 'node:test';
import { findIngestionSourceByDomain, INGESTION_SOURCES } from '../src/sources.js';

test('registry resolves adapters by canonical domain', () => {
  const domains = INGESTION_SOURCES.map((source) => source.domain);
  assert.deepEqual(domains, [
    'www.chinimandi.com',
    'krishijagran.com',
    'www.thehindubusinessline.com',
  ]);

  const source = findIngestionSourceByDomain('krishijagran.com');
  assert.ok(source);
  const adapter = source.createAdapter({ initialStatus: 'DRAFT' });
  assert.equal(adapter.source, 'WEBSITE');
  assert.equal(typeof adapter.collect, 'function');
});

test('unknown domains do not resolve', () => {
  assert.equal(findIngestionSourceByDomain('example.com'), undefined);
});
