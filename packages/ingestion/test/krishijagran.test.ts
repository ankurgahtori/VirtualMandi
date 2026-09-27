import assert from 'node:assert/strict';
import test from 'node:test';
import {
  KrishiJagranAdapter,
  parseKrishiJagranArticle,
  parseKrishiJagranListing,
} from '../src/krishijagran.js';
import { normalizeBlogPostInput } from '../src/normalize.js';

const listingHtml = `
<section id="main">
  <script>var c = 1184; var l = 197284;</script>
  <div class="main-post">
    <a href="/commodity-news/mandi-updates-sugar-fall/" title="Sugar prices fall">
      <img data-src="https://kj1bcdn.b-cdn.net//media/97008/sugar.jpg?width=450" />
    </a>
  </div>
  <div class="nc-item shadow-sm">
    <a href="/commodity-news/mandi-updates-wheat-rise/" class="img" title="Wheat &amp; rice update">
      <img data-src="https://kj1bcdn.b-cdn.net/media/97000/wheat.png?width=250" />
    </a>
    <h2 class="h">
      <a href="/commodity-news/mandi-updates-wheat-rise/" title="Wheat &amp; rice update">Wheat &amp; rice update</a>
    </h2>
  </div>
  <a href="/commodity-news" title="nav">should not match</a>
</section>`;

const articleHtml = `
<head>
<meta property="og:image" content="https://img-cdn.krishijagran.com/97008/sugar.jpg" />
<script type="application/ld+json">
{
  "@context":"http://schema.org",
  "@type":"NewsArticle",
  "headline": "Sugar prices fall ",
  "description":"Delhi saw the largest fall of 7% to Rs 3,800 per quintal.",
  "datePublished":"2024-04-13T09:50+5:30",
  "image":{"@type":"ImageObject","url":"https://img-cdn.krishijagran.com/97008/sugar.jpg"}
}
</script>
</head>
<body>
<h1 title="Sugar prices fall ">Sugar prices fall</h1>
<article>
  <figure><img src="x.jpg"/><figcaption>Image caption</figcaption></figure>
  <p><span>The monthly average wholesale price of sugar fell by Rs 47.</span></p>
  <div class="article-ad mb-3 text-center"><div id="kj_english_inarticle"></div></div>
  <p>Among all regions, Delhi saw the largest fall.</p>
  <div class="mt-2 article-published-date"><strong>First published on: 13 Apr 2024</strong></div>
</article>
</body>`;

const moreStoriesJson = {
  n: [
    {
      Id: 197171,
      Title: 'Wheat prices drop',
      CoverImage: 'https://krishijagran.com/media/96037/wheat.jpg',
      Url: 'https://krishijagran.com/commodity-news/mandi-updates-wheat-drop/',
      Desc: 'Wholesale wheat prices fell marginally in Bihar.',
    },
  ],
  isLast: true,
};

const htmlResponse = (body: string, status = 200) => new Response(body, { status });
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

test('parses listing cards, dedupes links, and reads pagination globals', () => {
  const listing = parseKrishiJagranListing(listingHtml);
  assert.equal(listing.categoryId, '1184');
  assert.equal(listing.lastId, '197284');
  assert.equal(listing.items.length, 2);
  assert.equal(
    listing.items[0].url,
    'https://krishijagran.com/commodity-news/mandi-updates-sugar-fall/',
  );
  assert.equal(listing.items[0].title, 'Sugar prices fall');
  assert.equal(listing.items[0].imageUrl, 'https://kj1bcdn.b-cdn.net//media/97008/sugar.jpg');
  assert.equal(listing.items[1].title, 'Wheat & rice update');
});

test('extracts title, summary, body and image from an article page', () => {
  const article = parseKrishiJagranArticle(articleHtml);
  assert.equal(article.title, 'Sugar prices fall');
  assert.equal(article.summary, 'Delhi saw the largest fall of 7% to Rs 3,800 per quintal.');
  assert.equal(article.imageUrl, 'https://img-cdn.krishijagran.com/97008/sugar.jpg');
  assert.equal(article.publishedAt?.toISOString(), '2024-04-13T04:20:00.000Z');
  assert.match(article.content ?? '', /fell by Rs 47/);
  assert.doesNotMatch(article.content ?? '', /Image caption/);
});

const routingFetch = (extra?: { stories?: typeof moreStoriesJson }) =>
  (async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes('/api/MoreStories')) {
      return jsonResponse(extra?.stories ?? { n: [], isLast: true });
    }
    if (url.includes('/commodity-news/') && url !== 'https://krishijagran.com/commodity-news') {
      return htmlResponse(articleHtml);
    }
    return htmlResponse(listingHtml);
  }) as typeof fetch;

test('maps listing stories to normalized adapter input', async () => {
  const adapter = new KrishiJagranAdapter({
    fetchImpl: routingFetch(),
    delayMs: 0,
    now: () => new Date('2026-09-27T00:00:00Z'),
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 2);

  const normalized = normalizeBlogPostInput(collected[0]);
  assert.equal(normalized.source, 'WEBSITE');
  assert.equal(normalized.sourceItemId, 'krishijagran-mandi-updates-sugar-fall');
  assert.equal(
    normalized.canonicalUrl,
    'https://krishijagran.com/commodity-news/mandi-updates-sugar-fall/',
  );
  assert.equal(normalized.summary, 'Delhi saw the largest fall of 7% to Rs 3,800 per quintal.');
  assert.equal(normalized.imageUrl, 'https://img-cdn.krishijagran.com/97008/sugar.jpg');
  assert.equal(normalized.translations[0].locale, 'en-IN');
  assert.equal(normalized.translations[0].title, 'Sugar prices fall');
  assert.match(normalized.translations[0].content, /Delhi saw the largest fall/);
  assert.deepEqual(normalized.categoryKeys, ['market-prices']);
  assert.equal(normalized.initialStatus, 'DRAFT');
});

test('walks MoreStories pages until isLast', async () => {
  const requested: string[] = [];
  const adapter = new KrishiJagranAdapter({
    maxPages: 3,
    delayMs: 0,
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url = input.toString();
      requested.push(url);
      if (url.includes('/api/MoreStories')) return jsonResponse(moreStoriesJson);
      if (url !== 'https://krishijagran.com/commodity-news') return htmlResponse(articleHtml);
      return htmlResponse(listingHtml);
    }) as typeof fetch,
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 3);
  const apiCalls = requested.filter((url) => url.includes('/api/MoreStories'));
  assert.equal(apiCalls.length, 1);
  const url = new URL(apiCalls[0]);
  assert.equal(url.searchParams.get('c'), '1184');
  assert.equal(url.searchParams.get('l'), '197284');
});

test('stops collecting once a story is older than --after', async () => {
  const adapter = new KrishiJagranAdapter({
    after: '2024-04-14T00:00:00Z',
    maxPages: 3,
    delayMs: 0,
    fetchImpl: routingFetch({ stories: moreStoriesJson }),
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 0);
});
