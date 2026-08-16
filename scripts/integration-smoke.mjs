const baseUrl = (process.env.API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      `${options.method ?? 'GET'} ${path} failed (${response.status}): ${body.error?.message ?? 'unknown error'}`,
    );
  return body;
};
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const login = await request('/v1/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'admin@virtualmandi.local', password: 'VirtualMandi123!' }),
});
const adminHeaders = { authorization: `Bearer ${login.tokens.accessToken}` };
const seeded = await request('/v1/admin/posts', { headers: adminHeaders });
assert(
  seeded.items.some((post) => post.id === 'seed-post-wheat-prices-2025'),
  'seeded post is missing',
);
const feedBefore = await request('/v1/feed/posts?locale=hi-IN&limit=50');
assert(feedBefore.items.length > 0, 'published feed is empty');
const email = `smoke-${crypto.randomUUID()}@virtualmandi.local`;
const farmer = await request('/v1/auth/register', {
  method: 'POST',
  body: JSON.stringify({ email, password: 'VirtualMandi123!' }),
});
const farmerHeaders = { authorization: `Bearer ${farmer.tokens.accessToken}` };
const created = await request('/v1/admin/posts', {
  method: 'POST',
  headers: adminHeaders,
  body: JSON.stringify({
    type: 'BLOG_POST',
    source: 'MANUAL',
    externalRedirectUrl: 'https://example.com/smoke-post',
    categoryIds: ['seed-category-market-prices'],
    locationIds: ['seed-location-india'],
    translations: [
      { locale: 'en-IN', title: 'Integration smoke post', content: 'Smoke test content' },
    ],
  }),
});
assert(created.status === 'DRAFT', 'new post must start as draft');
await request(`/v1/admin/posts/${created.id}/publish`, { method: 'POST', headers: adminHeaders });
let published = await request(
  '/v1/feed/posts?locale=en-IN&categoryId=seed-category-market-prices&locationId=seed-location-india&limit=50',
);
assert(
  published.items.some((post) => post.id === created.id),
  'published post missing from filtered feed',
);
await request(`/v1/admin/posts/${created.id}/archive`, { method: 'POST', headers: adminHeaders });
published = await request('/v1/feed/posts?locale=en-IN&limit=50');
assert(
  !published.items.some((post) => post.id === created.id),
  'archived post still appears in feed',
);
await request(`/v1/admin/posts/${created.id}/restore`, { method: 'POST', headers: adminHeaders });
published = await request('/v1/feed/posts?locale=en-IN&limit=50');
assert(
  published.items.some((post) => post.id === created.id),
  'restored post missing from feed',
);
await request(`/v1/admin/posts/${created.id}/remove`, { method: 'POST', headers: adminHeaders });
const farmerFeed = await request('/v1/feed/posts?locale=en-IN&limit=50', {
  headers: farmerHeaders,
});
assert(
  !farmerFeed.items.some((post) => post.id === created.id),
  'removed post still appears in feed',
);
console.log(
  JSON.stringify({
    ok: true,
    seededPost: 'visible',
    registeredUser: email,
    lifecycle: ['draft', 'published', 'archived', 'restored', 'removed'],
  }),
);
