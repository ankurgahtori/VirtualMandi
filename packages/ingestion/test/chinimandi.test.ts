import assert from 'node:assert/strict';
import test from 'node:test';
import { ChiniMandiAdapter, decodeHtmlEntities } from '../src/chinimandi.js';
import { normalizeBlogPostInput } from '../src/normalize.js';

const wpPost = {
  id: 388476,
  link: 'https://www.chinimandi.com/some-hindi-story/',
  title: { rendered: 'Daily update &#8211; 26/09/2026' },
  content: { rendered: '<p>गन्ना किसानों के लिए खबर &amp; अपडेट</p>' },
  excerpt: { rendered: '<p>संक्षिप्त</p>' },
  _embedded: {
    'wp:featuredmedia': [{ source_url: 'https://www.chinimandi.com/uploads/story.webp' }],
  },
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

test('decodes numeric and named HTML entities', () => {
  assert.equal(decodeHtmlEntities('a &#8211; b &amp; c &hellip;'), 'a – b & c …');
  assert.equal(decodeHtmlEntities('&#x201C;quote&#x201D;'), '“quote”');
});

test('maps WordPress posts to normalized adapter input', async () => {
  const adapter = new ChiniMandiAdapter({
    fetchImpl: async () => jsonResponse([wpPost]),
    delayMs: 0,
    now: () => new Date('2026-09-27T00:00:00Z'),
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 1);

  const normalized = normalizeBlogPostInput(collected[0]);
  assert.equal(normalized.source, 'WEBSITE');
  assert.equal(normalized.sourceItemId, 'chinimandi-388476');
  assert.equal(normalized.canonicalUrl, 'https://www.chinimandi.com/some-hindi-story/');
  assert.equal(normalized.externalRedirectUrl, 'https://www.chinimandi.com/some-hindi-story/');
  assert.equal(normalized.imageUrl, 'https://www.chinimandi.com/uploads/story.webp');
  assert.equal(normalized.translations[0].locale, 'hi-IN');
  assert.equal(normalized.translations[0].title, 'Daily update – 26/09/2026');
  assert.equal(normalized.translations[0].content, 'गन्ना किसानों के लिए खबर & अपडेट');
  assert.equal(normalized.translations[1].locale, 'en-IN');
  assert.deepEqual(normalized.categoryKeys, ['news']);
  assert.deepEqual(normalized.locationKeys, ['india']);
  assert.equal(normalized.initialStatus, 'DRAFT');
});

test('passes the after filter and stops when a short page arrives', async () => {
  const requested: string[] = [];
  const adapter = new ChiniMandiAdapter({
    after: '2026-09-26T00:00:00Z',
    perPage: 2,
    maxPages: 5,
    delayMs: 0,
    fetchImpl: async (url) => {
      requested.push(url.toString());
      return jsonResponse([wpPost]);
    },
  });
  for await (const item of adapter.collect()) assert.ok(item);
  assert.equal(requested.length, 1);
  const url = new URL(requested[0]);
  assert.equal(url.searchParams.get('after'), '2026-09-26T00:00:00Z');
  assert.equal(url.searchParams.get('categories'), '14');
  assert.equal(url.searchParams.get('per_page'), '2');
});

test('stops paginating on the WordPress out-of-range 400 response', async () => {
  let calls = 0;
  const adapter = new ChiniMandiAdapter({
    perPage: 1,
    maxPages: 5,
    delayMs: 0,
    fetchImpl: async () => {
      calls += 1;
      return calls === 1
        ? jsonResponse([wpPost])
        : jsonResponse({ code: 'rest_post_invalid_page_number' }, 400);
    },
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 1);
  assert.equal(calls, 2);
});
