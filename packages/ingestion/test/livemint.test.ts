import assert from 'node:assert/strict';
import test from 'node:test';
import { LiveMintAdapter, parseLiveMintArticle, parseLiveMintListing } from '../src/livemint.js';
import { normalizeBlogPostInput } from '../src/normalize.js';

const articleUrl =
  'https://www.livemint.com/industry/agriculture/apple-prices-india-himachal-apple-harvest-11786098244559.html';

const listingHtml = `<section class="listing">
  <a href="${articleUrl}" title="Apple prices set to stay high">
    <img data-src="https://images.livemint.com/img/apple.jpg" />
  </a>
  <h3><a href="${articleUrl}">Apple prices set to stay high until September</a></h3>
  <a href="/industry/agriculture/diesel-caps-bulk-sale-bans-11781265394135.html">
    Diesel caps, bulk sale bans
  </a>
  <a href="/industry/agriculture">section nav — must not match</a>
  <a href="https://www.livemint.com/news/other-story-11780000000000.html">
    other section — must not match
  </a>
</section>`;

const articleHtml = `<head>
<meta property="og:title" content="Apple prices set to stay high until September | Mint" />
<meta property="og:description" content="Crop damage in Himachal pushed prices up." />
<meta property="og:image" content="https://images.livemint.com/img/apple.jpg" />
<meta property="article:published_time" content="2026-08-07T17:28:31+05:30" />
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"NewsArticle","headline":"Apple prices set to stay high until September","description":"Crop damage in Himachal pushed prices up.","datePublished":"2026-08-07T17:28:31+05:30","image":"https://images.livemint.com/img/apple.jpg"}
</script>
</head><body>
<div class="premium-article-body contentSec subscription"><div class="mainArea" id="mainArea">
<div id="article-index-0" class="storyParagraph"><p><span>Prices of Indian apples are expected to remain high.</span></p></div>
<div class="paywall"><div id="article-index-2" class="storyParagraph"><p><span>Himachal output fell sharply.</span></p></div></div>
</div></div>
</body>`;

test('parses listing cards under the section path only', () => {
  const items = parseLiveMintListing(listingHtml);
  assert.equal(items.length, 2);
  assert.equal(items[0].url, articleUrl);
  assert.equal(items[0].title, 'Apple prices set to stay high');
  assert.equal(items[0].imageUrl, 'https://images.livemint.com/img/apple.jpg');
  assert.equal(
    items[1].url,
    'https://www.livemint.com/industry/agriculture/diesel-caps-bulk-sale-bans-11781265394135.html',
  );
});

test('extracts article fields from ld+json and storyParagraph body', () => {
  const article = parseLiveMintArticle(articleHtml);
  assert.equal(article.title, 'Apple prices set to stay high until September');
  assert.equal(article.summary, 'Crop damage in Himachal pushed prices up.');
  assert.equal(article.imageUrl, 'https://images.livemint.com/img/apple.jpg');
  assert.equal(article.publishedAt?.toISOString(), '2026-08-07T11:58:31.000Z');
  assert.match(article.content ?? '', /remain high/);
  assert.match(article.content ?? '', /output fell sharply/);
});

test('collects listing items and maps them to adapter input', async () => {
  const adapter = new LiveMintAdapter({
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === 'https://www.livemint.com/industry/agriculture')
        return new Response(listingHtml, { status: 200 });
      return new Response(articleHtml, { status: 200 });
    }) as typeof fetch,
    delayMs: 0,
    now: () => new Date('2026-09-27T00:00:00Z'),
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 2);

  const normalized = normalizeBlogPostInput(collected[0]);
  assert.equal(normalized.sourceItemId, 'livemint-11786098244559');
  assert.equal(normalized.canonicalUrl, articleUrl);
  assert.equal(normalized.summary, 'Crop damage in Himachal pushed prices up.');
  assert.equal(normalized.translations[0].title, 'Apple prices set to stay high until September');
  assert.equal(normalized.initialStatus, 'DRAFT');
});

test('stops collecting once a story is older than --after', async () => {
  const adapter = new LiveMintAdapter({
    after: '2026-09-01T00:00:00Z',
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === 'https://www.livemint.com/industry/agriculture')
        return new Response(listingHtml, { status: 200 });
      return new Response(articleHtml, { status: 200 });
    }) as typeof fetch,
    delayMs: 0,
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 0);
});
