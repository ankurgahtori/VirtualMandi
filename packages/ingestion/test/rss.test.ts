import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeBlogPostInput } from '../src/normalize.js';
import { parseRssArticle, parseRssFeed, RssAdapter } from '../src/rss.js';

const feedXml = `<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
<item>
<title><![CDATA[Gujarat bans analogue paneer]]></title>
<link>https://dairynews7x7.com/news/gujarat-bans-analogue-paneer/</link>
<pubDate>Sun, 27 Sep 2026 08:59:31 +0000</pubDate>
<description><![CDATA[Gujarat tightens restrictions on analogue dairy.]]></description>
<content:encoded><![CDATA[<p>Gujarat banned the sale of unstandardised paneer.</p><p>The ban covers cheese and butter too.</p>]]></content:encoded>
<enclosure url="https://dairynews7x7.com/img/paneer.jpg" />
</item>
<item>
<title><![CDATA[Milk prices rise]]></title>
<link>https://dairynews7x7.com/news/milk-prices-rise/</link>
<pubDate>Sat, 26 Sep 2026 08:59:31 +0000</pubDate>
<description><![CDATA[Retail prices ticked up.]]></description>
</item>
</channel></rss>`;

const articleHtml = `<head>
<meta property="og:title" content="Milk prices rise in Gujarat" />
<meta property="og:image" content="/img/milk.jpg" />
<meta property="article:published_time" content="2026-09-26T08:59:31+00:00" />
</head><body>
<div class="entry-content"><p>Milk retail prices rose by two rupees per litre.</p><p>Cooperatives cited feed costs.</p></div>
</body>`;

test('parses feed items incl. content:encoded bodies and enclosure images', () => {
  const items = parseRssFeed(feedXml);
  assert.equal(items.length, 2);
  assert.equal(items[0].url, 'https://dairynews7x7.com/news/gujarat-bans-analogue-paneer/');
  assert.equal(items[0].imageUrl, 'https://dairynews7x7.com/img/paneer.jpg');
  assert.match(items[0].content ?? '', /unstandardised paneer/);
  assert.equal(items[0].publishedAt?.toISOString(), '2026-09-27T08:59:31.000Z');
  assert.equal(items[1].content, undefined);
});

test('generic article extractor falls back to entry-content', () => {
  const article = parseRssArticle(articleHtml);
  assert.equal(article.title, 'Milk prices rise in Gujarat');
  assert.match(article.content ?? '', /two rupees/);
  assert.match(article.content ?? '', /feed costs/);
});

test('uses feed content:encoded without fetching articles', async () => {
  const fetched: string[] = [];
  const adapter = new RssAdapter({
    feedUrl: 'https://dairynews7x7.com/feed',
    idPrefix: 'rss-dairynews7x7',
    delayMs: 0,
    now: () => new Date('2026-09-27T00:00:00Z'),
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url = input.toString();
      fetched.push(url);
      if (url.endsWith('/feed')) return new Response(feedXml, { status: 200 });
      return new Response(articleHtml, { status: 200 });
    }) as typeof fetch,
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 2);
  // item 2 lacks content:encoded, so its article page is fetched — one article fetch total
  assert.deepEqual(
    fetched.filter((u) => !u.endsWith('/feed')),
    ['https://dairynews7x7.com/news/milk-prices-rise/'],
  );

  const normalized = normalizeBlogPostInput(collected[0]);
  assert.equal(normalized.sourceItemId, 'rss-dairynews7x7-gujarat-bans-analogue-paneer');
  assert.equal(normalized.summary, 'Gujarat tightens restrictions on analogue dairy.');
  assert.equal(normalized.translations[0].locale, 'en-IN');
  assert.equal(normalized.initialStatus, 'DRAFT');
});

test('discovers the feed from the listing page when feedUrl is absent', async () => {
  const listing = `<html><head><link rel="alternate" type="application/rss+xml" href="/feed" /></head></html>`;
  const adapter = new RssAdapter({
    listingUrl: 'https://dairynews7x7.com/category/daily-dairy-news/',
    delayMs: 0,
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === 'https://dairynews7x7.com/feed') return new Response(feedXml, { status: 200 });
      if (url.includes('/news/')) return new Response(articleHtml, { status: 200 });
      return new Response(listing, { status: 200 });
    }) as typeof fetch,
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 2);
});

test('stops collecting at items older than --after', async () => {
  const adapter = new RssAdapter({
    feedUrl: 'https://dairynews7x7.com/feed',
    after: '2026-09-27T00:00:00Z',
    delayMs: 0,
    fetchImpl: (async () => new Response(feedXml, { status: 200 })) as typeof fetch,
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 1);
});
