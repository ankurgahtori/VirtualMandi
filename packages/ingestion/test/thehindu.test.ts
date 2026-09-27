import assert from 'node:assert/strict';
import test from 'node:test';
import { TheHinduAdapter, parseTheHinduArticle, parseTheHinduListing } from '../src/thehindu.js';
import { normalizeBlogPostInput } from '../src/normalize.js';

const articleUrl =
  'https://www.thehindu.com/news/national/uttar-pradesh/up-focuses-on-sugarcane-varieties/article71509757.ece';

const listingHtml = `<section>
  <div class="element">
    <h3 class="title"><a href="${articleUrl}">U.P. focuses on high-yielding sugarcane varieties</a></h3>
    <div class="picture"><a href="${articleUrl}"><img src="x.jpg"/></a></div>
  </div>
  <div class="element">
    <h3 class="title"><a href="https://www.thehindu.com/business/tea-output-slips/article71509078.ece">Tea output slips</a></h3>
  </div>
  <aside>
    <a href="https://www.thehindu.com/entertainment/movies/welcome-to-the-jungle/article71149360.ece">sidebar story — must not match</a>
    <a href="https://sportstar.thehindu.com/football/story/article71060133.ece">sportstar — must not match</a>
  </aside>
</section>`;

const articleHtml = `<head>
<meta property="og:title" content="U.P. focuses on high-yielding sugarcane varieties" />
<meta property="og:description" content="Scientists push mechanization." />
<meta property="og:image" content="https://th-i.thgim.com/sugarcane.jpg" />
<meta property="article:published_time" content="2026-09-23T07:30:00+05:30"/>
</head><body>
<div class="articlebodycontent"><div itemprop="articleBody">
<p>Picture a farmer cultivating sugarcane.</p>
<p>Also read: unrelated promo</p>
<p>Millions of growers depend on the crop.</p>
</div></div>
</body>`;

test('parses h3.title cards on the listing host and skips sidebar links', () => {
  const items = parseTheHinduListing(listingHtml);
  assert.equal(items.length, 2);
  assert.equal(items[0].url, articleUrl);
  assert.equal(items[0].title, 'U.P. focuses on high-yielding sugarcane varieties');
  assert.equal(
    items[1].url,
    'https://www.thehindu.com/business/tea-output-slips/article71509078.ece',
  );
});

test('extracts article fields from meta and articleBody', () => {
  const article = parseTheHinduArticle(articleHtml);
  assert.equal(article.title, 'U.P. focuses on high-yielding sugarcane varieties');
  assert.equal(article.summary, 'Scientists push mechanization.');
  assert.equal(article.imageUrl, 'https://th-i.thgim.com/sugarcane.jpg');
  assert.equal(article.publishedAt?.toISOString(), '2026-09-23T02:00:00.000Z');
  assert.match(article.content ?? '', /Picture a farmer/);
  assert.doesNotMatch(article.content ?? '', /Also read/);
});

const routingFetch = () =>
  (async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes('.ece')) return new Response(articleHtml, { status: 200 });
    return new Response(listingHtml, { status: 200 });
  }) as typeof fetch;

test('collects listing items and maps them to adapter input', async () => {
  const adapter = new TheHinduAdapter({
    fetchImpl: routingFetch(),
    delayMs: 0,
    now: () => new Date('2026-09-27T00:00:00Z'),
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 2);

  const normalized = normalizeBlogPostInput(collected[0]);
  assert.equal(normalized.source, 'WEBSITE');
  assert.equal(normalized.sourceItemId, 'thehindu-71509757');
  assert.equal(normalized.canonicalUrl, articleUrl);
  assert.equal(normalized.summary, 'Scientists push mechanization.');
  assert.equal(
    normalized.translations[0].title,
    'U.P. focuses on high-yielding sugarcane varieties',
  );
  assert.equal(normalized.initialStatus, 'DRAFT');
});

test('walks ?page=N listings', async () => {
  const requested: string[] = [];
  const adapter = new TheHinduAdapter({
    maxPages: 2,
    delayMs: 0,
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url = input.toString();
      requested.push(url);
      if (url.includes('.ece')) return new Response(articleHtml, { status: 200 });
      return new Response(listingHtml, { status: 200 });
    }) as typeof fetch,
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 2);
  assert.ok(requested.some((url) => url.includes('page=2')));
});

test('stops collecting once a story is older than --after', async () => {
  const adapter = new TheHinduAdapter({
    after: '2026-09-24T00:00:00Z',
    fetchImpl: routingFetch(),
    delayMs: 0,
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 0);
});
