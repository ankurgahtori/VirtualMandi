const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  deg: '°',
  times: '×',
  copy: '©',
  reg: '®',
  trade: '™',
};

export const decodeHtmlEntities = (value: string): string =>
  value.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const hex = entity[1] === 'x' || entity[1] === 'X';
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });

export const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const readAttr = (markup: string, name: string) =>
  markup.match(new RegExp(`${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'))?.[2];

/** Reads `<meta property|name="<key>" content="...">` (either attribute order). */
export const readMeta = (html: string, key: string, attr: 'property' | 'name' = 'property') => {
  const tag = html.match(
    new RegExp(`<meta[^>]*${attr}=["']${escapeRegExp(key)}["'][^>]*>`, 'i'),
  )?.[0];
  return tag ? readAttr(tag, 'content') : undefined;
};

export const stripQuery = (value: string) => {
  try {
    const url = new URL(value);
    url.search = '';
    return url.toString();
  } catch {
    return value;
  }
};

export const stripTags = (html: string) =>
  decodeHtmlEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Finds the first application/ld+json record whose `@type` matches. Handles a
 * top-level object, an array of objects, and `@graph` blocks.
 */
export const findLdJson = (html: string, type: string): Record<string, unknown> | undefined => {
  const matches = (record: Record<string, unknown>) => {
    const recordType = record?.['@type'];
    return recordType === type || (Array.isArray(recordType) && recordType.includes(type));
  };
  const visit = (node: unknown): Record<string, unknown> | undefined => {
    if (!node || typeof node !== 'object') return undefined;
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item);
        if (found) return found;
      }
      return undefined;
    }
    const record = node as Record<string, unknown>;
    if (matches(record)) return record;
    return visit(record['@graph']);
  };
  for (const match of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const found = visit(JSON.parse(match[1]));
      if (found) return found;
    } catch {
      // Invalid ld+json blocks are common; skip them.
    }
  }
  return undefined;
};

/**
 * Extracts the element whose opening `<div ...>` tag contains `marker`
 * (e.g. `itemprop="articleBody"` or `class="... article-body ..."`) by scanning
 * `<div`/`</div>` tokens until the nesting depth returns to zero.
 */
export const extractDivByMarker = (html: string, marker: string): string => {
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return '';
  const divStart = html.lastIndexOf('<div', markerIndex);
  if (divStart === -1) return '';
  const innerStart = html.indexOf('>', divStart) + 1;
  if (innerStart === 0) return '';
  let depth = 1;
  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = innerStart;
  for (const match of html.matchAll(tagPattern)) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(innerStart, match.index);
  }
  return '';
};

/** Collects `<p>...</p>` blocks inside an HTML fragment. */
export const paragraphsIn = (html: string) =>
  [...html.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi)].map((m) => m[0]);
