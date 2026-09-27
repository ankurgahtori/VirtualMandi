import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeBlogPostInput } from '../src/normalize.js';
import { WordPressAdapter } from '../src/wordpress.js';

const wpPost = {
  id: 34017,
  link: 'https://emandirates.com/haryana-potato-seed-booking/',
  title: { rendered: 'Haryana potato seed booking opens' },
  content: { rendered: '<p>Farmers can book certified seed online.</p>' },
  excerpt: { rendered: '<p>Booking is open.</p>' },
  _embedded: {
    'wp:featuredmedia': [{ source_url: 'https://emandirates.com/img.jpg' }],
  },
};

const feedJson = JSON.stringify([wpPost]);

test('maps WP posts to adapter input with hostname-derived id prefix', async () => {
  const requested: string[] = [];
  const adapter = new WordPressAdapter({
    baseUrl: 'https://emandirates.com',
    categoryId: 165,
    delayMs: 0,
    now: () => new Date('2026-09-27T00:00:00Z'),
    fetchImpl: (async (input: RequestInfo | URL) => {
      requested.push(input.toString());
      return new Response(feedJson, { status: 200 });
    }) as typeof fetch,
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 1);
  assert.ok(requested[0].includes('categories=165'));
  assert.ok(requested[0].includes('_embed=1'));

  const normalized = normalizeBlogPostInput(collected[0]);
  assert.equal(normalized.sourceItemId, 'emandirates-com-34017');
  assert.equal(normalized.canonicalUrl, wpPost.link);
  assert.equal(normalized.translations[0].locale, 'en-IN');
  assert.equal(normalized.translations.length, 1);
});

test('mirrors non-English content into en-IN', async () => {
  const adapter = new WordPressAdapter({
    baseUrl: 'https://emandirates.com',
    categoryId: 165,
    contentLocale: 'hi-IN',
    delayMs: 0,
    fetchImpl: (async () => new Response(feedJson, { status: 200 })) as typeof fetch,
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  const normalized = normalizeBlogPostInput(collected[0]);
  assert.equal(normalized.translations.length, 2);
  assert.deepEqual(
    normalized.translations.map((t) => t.locale),
    ['hi-IN', 'en-IN'],
  );
});

test('passes the after filter to the WP API and stops on empty pages', async () => {
  const requested: string[] = [];
  const adapter = new WordPressAdapter({
    baseUrl: 'https://emandirates.com',
    categoryId: 165,
    after: '2026-09-01T00:00:00Z',
    perPage: 1,
    maxPages: 3,
    delayMs: 0,
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url = input.toString();
      requested.push(url);
      if (url.includes('page=2')) return new Response('[]', { status: 200 });
      return new Response(feedJson, { status: 200 });
    }) as typeof fetch,
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 1);
  assert.ok(requested[0].includes('after=2026-09-01'));
  assert.equal(requested.length, 2);
});

test('stops paginating on the WordPress out-of-range 400 response', async () => {
  const adapter = new WordPressAdapter({
    baseUrl: 'https://emandirates.com',
    categoryId: 165,
    maxPages: 5,
    delayMs: 0,
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('page=2')) return new Response('{}', { status: 400 });
      return new Response(feedJson, { status: 200 });
    }) as typeof fetch,
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 1);
});
