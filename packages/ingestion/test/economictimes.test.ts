import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EconomicTimesAdapter,
  parseEconomicTimesArticle,
  parseEconomicTimesFeed,
  parseEconomicTimesFeedUrl,
} from '../src/economictimes.js';
import { normalizeBlogPostInput } from '../src/normalize.js';

const listingUrl = 'https://economictimes.indiatimes.com/news/economy/agriculture';
const feedUrl = 'https://economictimes.indiatimes.com/rssfeeds/1202099874.cms';
const articleUrl =
  'https://economictimes.indiatimes.com/news/economy/agriculture/karnataka-announces-rs-2500-input-subsidy/articleshow/134486960.cms';

const listingHtml = `<head><link rel="alternate" type="application/rss+xml" href="${feedUrl}"></head>`;

const feedXml = `<?xml version="1.0"?><rss version="2.0"><channel>
<title>Agriculture-Economy-News-Economic Times</title>
<item><title><![CDATA[Karnataka announces Rs 2,500 input subsidy]]></title>
<description><![CDATA[Relief for drought-hit farmers across the state.]]></description>
<link>${articleUrl}</link>
<enclosure type="image/jpeg" url="https://img.etimg.com/photo/msid-134486960.cms" length="0"/>
<guid>${articleUrl}</guid>
<pubDate>Fri, 25 Sep 2026 19:09:41 +0530</pubDate></item>
<item><title><![CDATA[Old story]]></title><description><![CDATA[old]]></description>
<link>https://economictimes.indiatimes.com/news/economy/agriculture/old-story/articleshow/134000000.cms</link>
<pubDate>Mon, 01 Sep 2025 10:00:00 +0530</pubDate></item>
</channel></rss>`;

const articleHtml = `<head>
<meta property="og:image" content="https://img.etimg.com/photo/msid-134486960.cms" />
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"NewsArticle","headline":"Karnataka announces Rs 2,500 input subsidy","description":"Relief for drought-hit farmers.","datePublished":"2026-09-25T19:09:41+05:30","image":{"@type":"ImageObject","url":"https://img.etimg.com/photo/msid-134486960.cms"}}
</script>
</head><body><article class="artData clr ">
<p>Centre permits sale of excess tobacco from registered growers.</p>
<p class="heading"><span class="cSprite_b prime_icon"></span></p>
<p>Further assistance will depend on assessments.</p>
</article></body>`;

test('extracts the RSS feed link from a section page', () => {
  assert.equal(parseEconomicTimesFeedUrl(listingHtml), feedUrl);
  assert.equal(parseEconomicTimesFeedUrl('<head></head>'), undefined);
});

test('parses feed items with url, image, summary and pubDate', () => {
  const items = parseEconomicTimesFeed(feedXml);
  assert.equal(items.length, 2);
  assert.equal(items[0].url, articleUrl);
  assert.equal(items[0].title, 'Karnataka announces Rs 2,500 input subsidy');
  assert.equal(items[0].imageUrl, 'https://img.etimg.com/photo/msid-134486960.cms');
  assert.equal(items[0].publishedAt?.toISOString(), '2026-09-25T13:39:41.000Z');
});

test('extracts article fields from ld+json and <article> paragraphs', () => {
  const article = parseEconomicTimesArticle(articleHtml);
  assert.equal(article.title, 'Karnataka announces Rs 2,500 input subsidy');
  assert.equal(article.summary, 'Relief for drought-hit farmers.');
  assert.equal(article.imageUrl, 'https://img.etimg.com/photo/msid-134486960.cms');
  assert.match(article.content ?? '', /excess tobacco/);
  assert.doesNotMatch(article.content ?? '', /prime_icon/);
});

const routingFetch = () =>
  (async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url === feedUrl) return new Response(feedXml, { status: 200 });
    if (url === listingUrl) return new Response(listingHtml, { status: 200 });
    return new Response(articleHtml, { status: 200 });
  }) as typeof fetch;

test('collects feed items and maps them to adapter input', async () => {
  const adapter = new EconomicTimesAdapter({
    listingUrl,
    fetchImpl: routingFetch(),
    delayMs: 0,
    now: () => new Date('2026-09-27T00:00:00Z'),
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 2);

  const normalized = normalizeBlogPostInput(collected[0]);
  assert.equal(normalized.source, 'WEBSITE');
  assert.equal(normalized.sourceItemId, 'economictimes-134486960');
  assert.equal(normalized.canonicalUrl, articleUrl);
  assert.equal(normalized.summary, 'Relief for drought-hit farmers.');
  assert.equal(normalized.translations[0].locale, 'en-IN');
  assert.match(normalized.translations[0].content, /excess tobacco/);
  assert.deepEqual(normalized.categoryKeys, ['news']);
  assert.equal(normalized.initialStatus, 'DRAFT');
});

test('skips the listing fetch when feedUrl is configured', async () => {
  const requested: string[] = [];
  const adapter = new EconomicTimesAdapter({
    listingUrl,
    feedUrl,
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url = input.toString();
      requested.push(url);
      if (url === feedUrl) return new Response(feedXml, { status: 200 });
      return new Response(articleHtml, { status: 200 });
    }) as typeof fetch,
    delayMs: 0,
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 2);
  assert.ok(!requested.includes(listingUrl));
});

test('stops collecting at items older than --after', async () => {
  const adapter = new EconomicTimesAdapter({
    listingUrl,
    feedUrl,
    after: '2026-09-01T00:00:00Z',
    fetchImpl: routingFetch(),
    delayMs: 0,
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 1);
});
