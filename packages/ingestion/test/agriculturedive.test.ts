import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AgricultureDiveAdapter,
  parseAgricultureDiveArticle,
  parseAgricultureDiveListing,
} from '../src/agriculturedive.js';
import { normalizeBlogPostInput } from '../src/normalize.js';

const articleUrl =
  'https://www.agriculturedive.com/news/agtech-seedlings-bayer-biofuel-production/737048/';

const listingHtml = `<main>
  <a href="/news/agtech-seedlings-bayer-biofuel-production/737048/">
    <img src="https://imgproxy.divecdn.com/x.webp" />
    <h4>Agtech seedlings: Bayer scales biofuel production</h4>
  </a>
  <a href="https://www.agriculturedive.com/news/alico-citrus-tropicana/736801/">Alico exits citrus</a>
  <a href="/topic/crops/">section nav — must not match</a>
</main>`;

const articleHtml = `<head>
<meta property="og:title" content="Agtech seedlings: Bayer scales biofuel production" />
<meta property="article:published_time" content="2026-09-20T12:05:38-04:00" />
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"NewsArticle","headline":"Agtech seedlings: Bayer scales biofuel production","description":"Also in this week's farm technology news.","datePublished":"2026-09-20T12:05:38-04:00","image":{"@type":"ImageObject","url":"https://imgproxy.divecdn.com/x.webp"}}
</script>
</head><body>
<div class=" large medium article-body">
<div class="text-to-speech"><button>Listen to the article</button></div>
<p>Get the free daily newsletter read by industry experts</p>
<p>Farmers are forecast to spend more on labor and taxes.</p>
</div>
</body>`;

test('parses /news/<slug>/<id>/ cards and ignores non-story links', () => {
  const items = parseAgricultureDiveListing(listingHtml);
  assert.equal(items.length, 2);
  assert.equal(items[0].url, articleUrl);
  assert.equal(items[0].title, 'Agtech seedlings: Bayer scales biofuel production');
  assert.equal(items[0].imageUrl, 'https://imgproxy.divecdn.com/x.webp');
  assert.equal(items[1].url, 'https://www.agriculturedive.com/news/alico-citrus-tropicana/736801/');
});

test('extracts article fields and filters newsletter promos', () => {
  const article = parseAgricultureDiveArticle(articleHtml);
  assert.equal(article.title, 'Agtech seedlings: Bayer scales biofuel production');
  assert.equal(article.summary, "Also in this week's farm technology news.");
  assert.equal(article.publishedAt?.toISOString(), '2026-09-20T16:05:38.000Z');
  assert.match(article.content ?? '', /labor and taxes/);
  assert.doesNotMatch(article.content ?? '', /free daily newsletter/);
});

test('walks ?page=N and dedupes across pages', async () => {
  const requested: string[] = [];
  const adapter = new AgricultureDiveAdapter({
    maxPages: 3,
    delayMs: 0,
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url = input.toString();
      requested.push(url);
      if (url.includes('/news/')) return new Response(articleHtml, { status: 200 });
      if (url.includes('page=2')) return new Response(listingHtml, { status: 200 });
      if (url.includes('page=3')) return new Response('<main></main>', { status: 200 });
      return new Response(listingHtml, { status: 200 });
    }) as typeof fetch,
    now: () => new Date('2026-09-27T00:00:00Z'),
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  // page 1 + page 2 yield the same two stories, deduped
  assert.equal(collected.length, 2);
  assert.ok(requested.some((url) => url.includes('page=2')));
});

test('maps listing items to normalized adapter input', async () => {
  const adapter = new AgricultureDiveAdapter({
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('/news/')) return new Response(articleHtml, { status: 200 });
      return new Response(listingHtml, { status: 200 });
    }) as typeof fetch,
    delayMs: 0,
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 2);

  const normalized = normalizeBlogPostInput(collected[0]);
  assert.equal(normalized.sourceItemId, 'agriculturedive-737048');
  assert.equal(normalized.canonicalUrl, articleUrl);
  assert.equal(normalized.translations[0].locale, 'en-IN');
  assert.deepEqual(normalized.categoryKeys, ['news']);
});

test('stops collecting once a story is older than --after', async () => {
  const adapter = new AgricultureDiveAdapter({
    after: '2026-09-25T00:00:00Z',
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('/news/')) return new Response(articleHtml, { status: 200 });
      return new Response(listingHtml, { status: 200 });
    }) as typeof fetch,
    delayMs: 0,
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 0);
});
