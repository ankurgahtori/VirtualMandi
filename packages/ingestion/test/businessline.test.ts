import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BusinessLineAdapter,
  parseBusinessLineArticle,
  parseBusinessLineListing,
} from '../src/businessline.js';
import { normalizeBlogPostInput } from '../src/normalize.js';

const ARTICLE_PATH =
  '/economy/agri-business/pulses-exports-see-five-fold-growth/article71509403.ece';
const ARTICLE_URL = `https://www.thehindubusinessline.com${ARTICLE_PATH}`;
const ARTICLE2_URL =
  'https://www.thehindubusinessline.com/economy/agri-business/nabard-sanctions-loan/article71511545.ece';

const listingHtml = `
<section class="center-section">
  <div class="element bigger main-element bottomborder">
    <div class="picture Storyline ratio ratio-16x9">
      <a href="${ARTICLE_URL}" class="focuspoint">
        <img src="https://www.thehindubusinessline.com/filler784"
             data-src-template="https://bl-i.thgim.com/public/incoming/861ydf/article71509403.ece/alternates/FREE_660/pulses.jpg" />
      </a>
    </div>
    <div class="right-content">
      <h3 class="title "><a href="${ARTICLE_URL}">India&rsquo;s pulses exports see a five-fold growth</a></h3>
    </div>
  </div>
  <div class="element">
    <div class="right-content">
      <h3 class="title "><a href="${ARTICLE2_URL}">NABARD sanctions loan for fisheries</a></h3>
    </div>
  </div>
  <a href="https://www.thehindubusinessline.com/economy/agri-business/" class="page-link">section nav</a>
  <a href="?page=2" class="page-link">2</a>
</section>`;

const articleHtml = `
<head>
<meta property="og:title" content="India's pulses exports see a five-fold growth in past 10 years" />
<meta property="og:description" content="Pulses exports surge fivefold in a decade." />
<meta property="og:image" content="https://bl-i.thgim.com/public/incoming/w6c9tx/article71477294.ece/alternates/LANDSCAPE_1200/pulses.jpg" />
<meta property="article:published_time" content="2026-09-25T20:56:27+05:30"/>
</head>
<body>
<div id="tag-related"></div>
<div id="ControlPara" class="contentbody" itemprop="articleBody"><p>GI tagged tur dal from Kalaburgi has found its way into the Maldives market.</p><div class="article-picture fullview top-pic"><div class="picture-responsive"><img src="pic1.jpg"/></div></div><p>Overall pulses exports crossed a million tonnes during 2025-26.</p></div>
<script data-cfasync="false">var totalPcount = 2;</script>
</body>`;

const listingPage2Html = `
<section class="center-section">
  <div class="element">
    <div class="right-content">
      <h3 class="title "><a href="${ARTICLE_URL}">India&rsquo;s pulses exports see a five-fold growth</a></h3>
    </div>
  </div>
  <div class="element">
    <div class="right-content">
      <h3 class="title "><a href="https://www.thehindubusinessline.com/economy/agri-business/malaysian-minister-to-lead-delegation/article71509561.ece">Malaysian minister to lead delegation</a></h3>
    </div>
  </div>
</section>`;

const htmlResponse = (body: string, status = 200) => new Response(body, { status });

const redirectedResponse = (body: string) => {
  const response = htmlResponse(body);
  Object.defineProperty(response, 'redirected', { value: true });
  return response;
};

test('parses listing cards, merging picture and headline anchors per URL', () => {
  const items = parseBusinessLineListing(listingHtml);
  assert.equal(items.length, 2);
  assert.equal(items[0].url, ARTICLE_URL);
  assert.equal(items[0].title, 'India’s pulses exports see a five-fold growth');
  assert.equal(
    items[0].imageUrl,
    'https://bl-i.thgim.com/public/incoming/861ydf/article71509403.ece/alternates/FREE_660/pulses.jpg',
  );
  assert.equal(items[1].title, 'NABARD sanctions loan for fisheries');
});

test('extracts title, summary, body, image and date from an article page', () => {
  const article = parseBusinessLineArticle(articleHtml);
  assert.equal(article.title, "India's pulses exports see a five-fold growth in past 10 years");
  assert.equal(article.summary, 'Pulses exports surge fivefold in a decade.');
  assert.equal(
    article.imageUrl,
    'https://bl-i.thgim.com/public/incoming/w6c9tx/article71477294.ece/alternates/LANDSCAPE_1200/pulses.jpg',
  );
  assert.equal(article.publishedAt?.toISOString(), '2026-09-25T15:26:27.000Z');
  assert.match(article.content ?? '', /tur dal from Kalaburgi/);
  assert.match(article.content ?? '', /crossed a million tonnes/);
  assert.doesNotMatch(article.content ?? '', /article-picture/);
  assert.doesNotMatch(article.content ?? '', /totalPcount/);
});

const routingFetch = () =>
  (async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.endsWith('.ece')) return htmlResponse(articleHtml);
    return htmlResponse(listingHtml);
  }) as typeof fetch;

test('maps listing stories to normalized adapter input', async () => {
  const adapter = new BusinessLineAdapter({
    fetchImpl: routingFetch(),
    delayMs: 0,
    now: () => new Date('2026-09-27T00:00:00Z'),
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 2);

  const normalized = normalizeBlogPostInput(collected[0]);
  assert.equal(normalized.source, 'WEBSITE');
  assert.equal(normalized.sourceItemId, 'businessline-71509403');
  assert.equal(normalized.canonicalUrl, ARTICLE_URL);
  assert.equal(normalized.summary, 'Pulses exports surge fivefold in a decade.');
  assert.equal(normalized.translations[0].locale, 'en-IN');
  assert.match(normalized.translations[0].content, /tur dal from Kalaburgi/);
  assert.deepEqual(normalized.categoryKeys, ['news']);
  assert.equal(normalized.initialStatus, 'DRAFT');
});

test('walks ?page=N listings until the out-of-range redirect', async () => {
  const requested: string[] = [];
  const adapter = new BusinessLineAdapter({
    maxPages: 5,
    delayMs: 0,
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url = input.toString();
      requested.push(url);
      if (url.endsWith('.ece')) return htmlResponse(articleHtml);
      // Page 2 repeats one story from page 1 plus a new one; page 3 redirects.
      if (url.includes('page=3')) return redirectedResponse(listingHtml);
      if (url.includes('page=2')) return htmlResponse(listingPage2Html);
      return htmlResponse(listingHtml);
    }) as typeof fetch,
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  // 2 stories on page 1 + 1 new on page 2 (repeat deduped); the page=3
  // redirect stops the walk.
  assert.equal(collected.length, 3);
  assert.ok(requested.some((url) => url.includes('page=2')));
  assert.ok(!requested.some((url) => url.includes('page=4')));
});

test('stops collecting once a story is older than --after', async () => {
  const adapter = new BusinessLineAdapter({
    after: '2026-09-26T00:00:00Z',
    maxPages: 3,
    delayMs: 0,
    fetchImpl: routingFetch(),
  });
  const collected = [];
  for await (const item of adapter.collect()) collected.push(item);
  assert.equal(collected.length, 0);
});
