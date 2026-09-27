import assert from 'node:assert/strict';
import test from 'node:test';
import { GenericHtmlAdapter, parseGenericHtmlListing } from '../src/generic-html.js';
import { normalizeBlogPostInput } from '../src/normalize.js';

const articleUrl = 'https://www.apk-inform.com/en/news/1556673';

const listingHtml = `<section>
  <a href="${articleUrl}"><img data-src="https://www.apk-inform.com/img/corn.jpg" /></a>
  <a href="${articleUrl}"><h3>Ukrainian corn prices continue to decline</h3></a>
  <a href="/en/news/1556672">Wheat exports steady</a>
  <a href="/en/news/price">section nav — must not match</a>
  <a href="https://other.example.com/en/news/9999">foreign host — must not match</a>
</section>`;

const articleHtml = `<head>
<meta property="og:title" content="Ukrainian corn prices continue to decline" />
<meta property="og:description" content="Harvest pressure is building." />
<meta property="og:image" content="https://www.apk-inform.com/img/corn.jpg" />
</head><body>
<div class="content-article-text content-text"><p>Corn prices declined this week.</p><p>Traders cite harvest supply.</p></div>
</body>`;

const pattern = /^\/en\/news\/\d+$/;

test('parses listing anchors, merges image+titled card halves, respects host', () => {
  const items = parseGenericHtmlListing(listingHtml, 'https://www.apk-inform.com/en/news', pattern);
  assert.equal(items.length, 2);
  assert.equal(items[0].url, articleUrl);
  assert.equal(items[0].title, 'Ukrainian corn prices continue to decline');
  assert.equal(items[0].imageUrl, 'https://www.apk-inform.com/img/corn.jpg');
});

test('bodyMarker supplies the article body when heuristics miss', async () => {
  const adapter = new GenericHtmlAdapter({
    listingUrl: 'https://www.apk-inform.com/en/news',
    articleUrlPattern: '^/en/news/\\d+$',
    bodyMarker: 'content-article-text',
    delayMs: 0,
    now: () => new Date('2026-09-27T00:00:00Z'),
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (/\/en\/news\/\d+$/.test(url)) return new Response(articleHtml, { status: 200 });
      return new Response(listingHtml, { status: 200 });
    }) as typeof fetch,
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 2);

  const normalized = normalizeBlogPostInput(collected[0]);
  assert.equal(normalized.sourceItemId, 'html-apk-inform-com-1556673');
  assert.equal(normalized.canonicalUrl, articleUrl);
  assert.equal(normalized.translations[0].title, 'Ukrainian corn prices continue to decline');
  assert.match(normalized.translations[0].content ?? '', /harvest supply/);
});

test('excludeUrlPattern filters nav links', () => {
  const html = `<a href="/news/author/jane-doe">Jane</a><a href="/news/story-slug-here">Story</a>`;
  const items = parseGenericHtmlListing(
    html,
    'https://example.com',
    /^\/news\/[a-z0-9-]+$/,
    /author/,
  );
  assert.equal(items.length, 1);
  assert.ok(items[0].url.endsWith('story-slug-here'));
});

test('mirrors non-English content into en-IN', async () => {
  const adapter = new GenericHtmlAdapter({
    listingUrl: 'https://www.apk-inform.com/en/news',
    articleUrlPattern: '^/en/news/\\d+$',
    bodyMarker: 'content-article-text',
    contentLocale: 'hi-IN',
    delayMs: 0,
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (/\/en\/news\/\d+$/.test(url)) return new Response(articleHtml, { status: 200 });
      return new Response(listingHtml, { status: 200 });
    }) as typeof fetch,
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  const normalized = normalizeBlogPostInput(collected[0]);
  assert.deepEqual(
    normalized.translations.map((t) => t.locale),
    ['hi-IN', 'en-IN'],
  );
});
