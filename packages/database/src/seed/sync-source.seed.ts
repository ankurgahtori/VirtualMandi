import { prisma } from '../client.js';
import { Prisma } from '../generated/client.js';

type SeedCategory = {
  label: string;
  listingUrl: string;
  feedCategoryKey?: string;
  locationKey?: string;
  adapterConfig?: Record<string, unknown>;
};

type SeedSource = {
  domain: string;
  label: string;
  adapterKey: string;
  categories: SeedCategory[];
};

const SOURCES: SeedSource[] = [
  {
    domain: 'www.chinimandi.com',
    label: 'ChiniMandi — Indian sugar news (Hindi)',
    adapterKey: 'chinimandi',
    categories: [
      {
        label: 'Indian sugar news (Hindi)',
        // Root URL so every scraped ChiniMandi post path-prefixes this listing.
        listingUrl: 'https://www.chinimandi.com/',
        feedCategoryKey: 'news',
        locationKey: 'india',
        adapterConfig: { categoryId: 14 },
      },
    ],
  },
  {
    domain: 'krishijagran.com',
    label: 'Krishi Jagran',
    adapterKey: 'krishijagran',
    categories: [
      {
        label: 'Commodity news',
        listingUrl: 'https://krishijagran.com/commodity-news',
        feedCategoryKey: 'market-prices',
        locationKey: 'india',
      },
      {
        label: 'Industry news',
        listingUrl: 'https://krishijagran.com/industry-news',
        feedCategoryKey: 'news',
        locationKey: 'india',
      },
      {
        label: 'News',
        listingUrl: 'https://krishijagran.com/news',
        feedCategoryKey: 'news',
        locationKey: 'india',
      },
    ],
  },
  {
    domain: 'www.thehindubusinessline.com',
    label: 'The Hindu BusinessLine',
    adapterKey: 'businessline',
    categories: [
      {
        label: 'Agri business',
        listingUrl: 'https://www.thehindubusinessline.com/economy/agri-business/',
        feedCategoryKey: 'news',
        locationKey: 'india',
      },
      {
        label: 'Pulses commodity',
        listingUrl: 'https://www.thehindubusinessline.com/topic/pulses-commodity/',
        feedCategoryKey: 'market-prices',
        locationKey: 'india',
      },
      {
        label: 'Dairy industry',
        listingUrl: 'https://www.thehindubusinessline.com/topic/dairy-industry/',
        feedCategoryKey: 'news',
        locationKey: 'india',
      },
    ],
  },
  {
    domain: 'emandirates.com',
    label: 'eMandi Rates (Hindi)',
    adapterKey: 'wordpress',
    categories: [
      {
        label: 'Krishi Vyapar',
        listingUrl: 'https://emandirates.com/category/krishi-vyapar/',
        feedCategoryKey: 'market-prices',
        locationKey: 'india',
        adapterConfig: { wpCategoryId: 165, contentLocale: 'hi-IN' },
      },
      {
        label: 'Government schemes for farmers',
        listingUrl: 'https://emandirates.com/category/government-scheme-for-farmers/',
        feedCategoryKey: 'news',
        locationKey: 'india',
        adapterConfig: { wpCategoryId: 199, contentLocale: 'hi-IN' },
      },
      {
        label: 'News for farmers',
        listingUrl: 'https://emandirates.com/category/news-for-farmer/',
        feedCategoryKey: 'news',
        locationKey: 'india',
        adapterConfig: { wpCategoryId: 4, contentLocale: 'hi-IN' },
      },
    ],
  },
  {
    domain: 'www.krishakjagat.org',
    label: 'Krishak Jagat (Hindi)',
    adapterKey: 'wordpress',
    categories: [
      {
        label: 'National agriculture news',
        listingUrl: 'https://www.krishakjagat.org/category/national-news/',
        feedCategoryKey: 'news',
        locationKey: 'india',
        adapterConfig: { wpCategoryId: 6, contentLocale: 'hi-IN' },
      },
    ],
  },
  {
    domain: 'millingandmillers.com',
    label: 'Milling & Millers',
    adapterKey: 'wordpress',
    categories: [
      {
        label: 'Rice',
        listingUrl: 'https://millingandmillers.com/rice/',
        feedCategoryKey: 'market-prices',
        locationKey: 'india',
        adapterConfig: { wpCategoryId: 74 },
      },
    ],
  },
  {
    domain: 'www.agribusinessglobal.com',
    label: 'AgriBusiness Global',
    adapterKey: 'wordpress',
    categories: [
      {
        label: 'Agrochemicals',
        listingUrl: 'https://www.agribusinessglobal.com/agrochemicals/',
        feedCategoryKey: 'news',
        adapterConfig: { wpCategoryId: 4 },
      },
    ],
  },
  {
    domain: 'farmersreviewafrica.com',
    label: 'Farmers Review Africa',
    adapterKey: 'wordpress',
    categories: [
      {
        label: 'AgriChem',
        listingUrl: 'https://farmersreviewafrica.com/category/agrichem/',
        feedCategoryKey: 'news',
        adapterConfig: { wpCategoryId: 143 },
      },
    ],
  },
  {
    domain: 'fertiliserindia.com',
    label: 'Fertiliser India',
    adapterKey: 'wordpress',
    categories: [
      {
        label: 'Latest',
        listingUrl: 'https://fertiliserindia.com/category/latest/',
        feedCategoryKey: 'news',
        locationKey: 'india',
        adapterConfig: { wpCategoryId: 10 },
      },
    ],
  },
  {
    domain: 'economictimes.indiatimes.com',
    label: 'Economic Times',
    adapterKey: 'economictimes',
    categories: [
      {
        label: 'Agriculture news',
        listingUrl: 'https://economictimes.indiatimes.com/news/economy/agriculture',
        feedCategoryKey: 'news',
        locationKey: 'india',
      },
    ],
  },
  {
    domain: 'www.livemint.com',
    label: 'Mint',
    adapterKey: 'livemint',
    categories: [
      {
        label: 'Agriculture',
        listingUrl: 'https://www.livemint.com/industry/agriculture',
        feedCategoryKey: 'news',
        locationKey: 'india',
      },
    ],
  },
  {
    domain: 'www.agriculturedive.com',
    label: 'Agriculture Dive',
    adapterKey: 'agriculturedive',
    categories: [
      {
        label: 'Crops',
        listingUrl: 'https://www.agriculturedive.com/topic/crops/',
        feedCategoryKey: 'news',
        locationKey: 'india',
      },
      {
        label: 'Dairy',
        listingUrl: 'https://www.agriculturedive.com/topic/dairy/',
        feedCategoryKey: 'news',
        locationKey: 'india',
      },
    ],
  },
  {
    domain: 'dairynews7x7.com',
    label: 'Dairy News 7x7',
    adapterKey: 'rss',
    categories: [
      {
        label: 'Daily dairy news',
        listingUrl: 'https://dairynews7x7.com/category/daily-dairy-news/',
        feedCategoryKey: 'news',
        adapterConfig: { feedUrl: 'https://dairynews7x7.com/feed' },
      },
    ],
  },
  {
    domain: 'ssricenews.com',
    label: 'SSRice News',
    adapterKey: 'rss',
    categories: [
      {
        label: 'Top rice news',
        listingUrl: 'https://ssricenews.com/rice-news/top-news.html',
        feedCategoryKey: 'market-prices',
        adapterConfig: { feedUrl: 'https://ssricenews.com/rice-news/top-news.feed?type=rss' },
      },
    ],
  },
  {
    domain: 'www.africancashewalliance.com',
    label: 'African Cashew Alliance',
    adapterKey: 'generic-html',
    categories: [
      {
        label: 'Cashew news',
        listingUrl: 'https://www.africancashewalliance.com/en/news-and-info/cashew-news',
        feedCategoryKey: 'news',
        adapterConfig: {
          articleUrlPattern: '^/en/news-and-info/blog/[a-z0-9-]+/?$',
          bodyMarker: 'field-name-body',
        },
      },
    ],
  },
  {
    domain: 'agrowon.esakal.com',
    label: 'Agrowon (Marathi)',
    adapterKey: 'generic-html',
    categories: [
      {
        label: 'Mukhya Batamya',
        listingUrl: 'https://agrowon.esakal.com/mukhya-batamya',
        feedCategoryKey: 'news',
        locationKey: 'india',
        adapterConfig: {
          articleUrlPattern: '^/[a-z-]+/[a-z0-9-]+$',
          excludeUrlPattern: '/(author|web-stories|epaper|privacy|about|contact)/',
          contentLocale: 'mr-IN',
        },
      },
    ],
  },
  {
    domain: 'www.apk-inform.com',
    label: 'APK-Inform',
    adapterKey: 'generic-html',
    categories: [
      {
        label: 'News (English)',
        listingUrl: 'https://www.apk-inform.com/en/news',
        feedCategoryKey: 'news',
        adapterConfig: {
          articleUrlPattern: '^/en/news/\\d+$',
          bodyMarker: 'content-article-text',
        },
      },
    ],
  },
  {
    domain: 'www.bizzbuzz.news',
    label: 'BizzBuzz',
    adapterKey: 'generic-html',
    categories: [
      {
        label: 'Agriculture industry',
        listingUrl: 'https://www.bizzbuzz.news/industry/agriculture',
        feedCategoryKey: 'news',
        locationKey: 'india',
        adapterConfig: { articleUrlPattern: '^/industry/agriculture/[a-z0-9-]+$' },
      },
    ],
  },
  {
    domain: 'www.business-standard.com',
    label: 'Business Standard',
    adapterKey: 'generic-html',
    categories: [
      {
        label: 'Agriculture',
        listingUrl: 'https://www.business-standard.com/topic/agriculture',
        feedCategoryKey: 'news',
        locationKey: 'india',
        adapterConfig: {
          articleUrlPattern: '^/industry/agriculture/[a-z0-9-]+-\\d+_\\d+\\.html$',
        },
      },
    ],
  },
  {
    domain: 'www.deccanherald.com',
    label: 'Deccan Herald',
    adapterKey: 'generic-html',
    categories: [
      {
        label: 'Agriculture',
        listingUrl: 'https://www.deccanherald.com/tags/agriculture',
        feedCategoryKey: 'news',
        locationKey: 'india',
        adapterConfig: { articleUrlPattern: '^/[a-z-]+/[a-z-]+/[a-z0-9-]+-\\d{5,}/?$' },
      },
    ],
  },
  {
    domain: 'www.fwi.co.uk',
    label: 'Farmers Weekly',
    adapterKey: 'generic-html',
    categories: [
      {
        label: 'Latest articles',
        listingUrl: 'https://www.fwi.co.uk/latest/articles-published-last-24-hours',
        feedCategoryKey: 'news',
        adapterConfig: {
          articleUrlPattern:
            '^/(news|arable|business|livestock|machinery)/[a-z0-9-]+/[a-z0-9-]+(/[a-z0-9-]+)?$',
          pageParam: 'none',
        },
      },
    ],
  },
  {
    domain: 'www.kisantak.in',
    label: 'Kisan Tak (Hindi)',
    adapterKey: 'generic-html',
    categories: [
      {
        label: 'Crops',
        listingUrl: 'https://www.kisantak.in/crops',
        feedCategoryKey: 'news',
        locationKey: 'india',
        adapterConfig: {
          articleUrlPattern: '^/[a-z-]+/story/[a-z0-9-]+$',
          bodyMarker: 'field--name-body',
          contentLocale: 'hi-IN',
        },
      },
    ],
  },
  {
    domain: 'www.mundus-agri.eu',
    label: 'Mundus Agri',
    adapterKey: 'generic-html',
    categories: [
      {
        label: 'Latest',
        listingUrl: 'https://www.mundus-agri.eu/latest',
        feedCategoryKey: 'news',
        adapterConfig: {
          articleUrlPattern: '^/news/[a-z0-9-]+\\.n\\d+\\.html$',
          bodyMarker: 'news-text',
        },
      },
    ],
  },
  {
    domain: 'www.ndtv.com',
    label: 'NDTV',
    adapterKey: 'generic-html',
    categories: [
      {
        label: 'Agriculture',
        listingUrl: 'https://www.ndtv.com/topic/agriculture',
        feedCategoryKey: 'news',
        locationKey: 'india',
        adapterConfig: { articleUrlPattern: '^/[a-z-]+/[a-z0-9-]+-\\d{7,}/?$' },
      },
    ],
  },
  {
    domain: 'www.outlookindia.com',
    label: 'Outlook India',
    adapterKey: 'generic-html',
    categories: [
      {
        label: 'Agriculture',
        listingUrl: 'https://www.outlookindia.com/topic/agriculture',
        feedCategoryKey: 'news',
        locationKey: 'india',
        adapterConfig: {
          articleUrlPattern:
            '^/(national|international|business|announcements|hub4business|education|features)/[a-z0-9-]+/?$',
          excludeUrlPattern: '/author/',
        },
      },
    ],
  },
  {
    domain: 'timesofindia.indiatimes.com',
    label: 'Times of India',
    adapterKey: 'generic-html',
    categories: [
      {
        label: 'Agriculture',
        listingUrl: 'https://timesofindia.indiatimes.com/topic/agriculture/',
        feedCategoryKey: 'news',
        locationKey: 'india',
        adapterConfig: { articleUrlPattern: '/articleshow/\\d+\\.cms' },
      },
    ],
  },
  {
    domain: 'www.world-grain.com',
    label: 'World Grain',
    adapterKey: 'generic-html',
    categories: [
      {
        label: 'News',
        listingUrl: 'https://www.world-grain.com/articles/topic/1024',
        feedCategoryKey: 'news',
        adapterConfig: {
          articleUrlPattern: '^/articles/\\d+-[a-z0-9-]+$',
          bodyMarker: 'main-content',
        },
      },
    ],
  },
  {
    domain: 'news.agropages.com',
    label: 'AgroPages',
    adapterKey: 'generic-html',
    categories: [
      {
        label: 'News',
        listingUrl: 'https://news.agropages.com/',
        feedCategoryKey: 'news',
        adapterConfig: {
          articleUrlPattern: '^/News/NewsDetail---\\d+\\.htm$',
          bodyMarker: 'article_content',
        },
      },
    ],
  },
  {
    domain: 'www.fertilizerdaily.com',
    label: 'Fertilizer Daily',
    adapterKey: 'generic-html',
    categories: [
      {
        label: 'Markets',
        listingUrl: 'https://www.fertilizerdaily.com/markets/',
        feedCategoryKey: 'market-prices',
        adapterConfig: {
          articleUrlPattern: '^/\\d{8}-[a-z0-9-]+/$',
          bodyMarker: 'js-goto-link-inside',
        },
      },
    ],
  },
  {
    domain: 'www.tribuneindia.com',
    label: 'The Tribune',
    adapterKey: 'generic-html',
    categories: [
      {
        label: 'Agriculture',
        listingUrl: 'https://www.tribuneindia.com/topic/agriculture',
        feedCategoryKey: 'news',
        locationKey: 'india',
        adapterConfig: { articleUrlPattern: '^/news/[a-z-]+/[a-z0-9-]{25,}/?$' },
      },
    ],
  },
  {
    domain: 'www.moneycontrol.com',
    label: 'Moneycontrol',
    adapterKey: 'generic-html',
    categories: [
      {
        label: 'Agriculture',
        listingUrl: 'https://www.moneycontrol.com/news/tags/agriculture.html',
        feedCategoryKey: 'news',
        locationKey: 'india',
        adapterConfig: { articleUrlPattern: '^/news/[a-z-]+/[a-z0-9-]+-\\d+\\.html$' },
      },
    ],
  },
  {
    domain: 'www.foodingredientsfirst.com',
    label: 'Food Ingredients First',
    adapterKey: 'generic-html',
    categories: [
      {
        label: 'News',
        listingUrl: 'https://www.foodingredientsfirst.com/news.html',
        feedCategoryKey: 'news',
        adapterConfig: {
          articleUrlPattern: '^/news/[a-z0-9-]+\\.html$',
          bodyMarker: 'news-text',
        },
      },
    ],
  },
  {
    domain: 'www.thehindu.com',
    label: 'The Hindu',
    adapterKey: 'thehindu',
    categories: [
      {
        label: 'Agriculture',
        listingUrl: 'https://www.thehindu.com/topic/Agriculture/',
        feedCategoryKey: 'news',
        locationKey: 'india',
      },
    ],
  },
];

export const seedSyncSources = async () => {
  for (const source of SOURCES) {
    const row = await prisma.syncSource.upsert({
      where: { domain: source.domain },
      update: { label: source.label, adapterKey: source.adapterKey },
      create: { domain: source.domain, label: source.label, adapterKey: source.adapterKey },
    });
    for (const category of source.categories) {
      const feedCategory = category.feedCategoryKey
        ? await prisma.category.findUnique({ where: { key: category.feedCategoryKey } })
        : null;
      const location = category.locationKey
        ? await prisma.location.findUnique({ where: { key: category.locationKey } })
        : null;
      const data = {
        label: category.label,
        categoryId: feedCategory?.id ?? null,
        locationId: location?.id ?? null,
        adapterConfig: category.adapterConfig
          ? (category.adapterConfig as Prisma.InputJsonValue)
          : Prisma.DbNull,
      };
      await prisma.syncSourceCategory.upsert({
        where: {
          syncSourceId_listingUrl: {
            syncSourceId: row.id,
            listingUrl: category.listingUrl,
          },
        },
        update: data,
        create: { ...data, syncSourceId: row.id, listingUrl: category.listingUrl },
      });
    }
  }
};

/**
 * Links already-ingested website posts to their SyncSource (canonicalUrl
 * hostname) and SyncSourceCategory (longest listingUrl path-prefix match).
 * Idempotent: only touches rows missing syncSourceId.
 */
export const backfillPostSyncAttribution = async () => {
  const sources = await prisma.syncSource.findMany({
    select: {
      id: true,
      domain: true,
      categories: { select: { id: true, listingUrl: true } },
    },
  });
  const posts = await prisma.post.findMany({
    where: { ingestionSource: 'WEBSITE', canonicalUrl: { not: null }, syncSourceId: null },
    select: { id: true, canonicalUrl: true },
  });
  let linked = 0;
  for (const post of posts) {
    let url: URL;
    try {
      url = new URL(post.canonicalUrl!);
    } catch {
      continue;
    }
    const source = sources.find((entry) => entry.domain === url.hostname);
    if (!source) continue;
    const category = source.categories
      .map((entry) => {
        try {
          return { id: entry.id, base: new URL(entry.listingUrl).pathname.replace(/\/+$/, '') };
        } catch {
          return undefined;
        }
      })
      .filter((entry): entry is { id: string; base: string } => entry !== undefined)
      .sort((a, b) => b.base.length - a.base.length)
      .find((entry) => url.pathname === entry.base || url.pathname.startsWith(`${entry.base}/`));
    await prisma.post.update({
      where: { id: post.id },
      data: { syncSourceId: source.id, syncSourceCategoryId: category?.id ?? null },
    });
    linked += 1;
  }
  return linked;
};
