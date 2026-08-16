import assert from 'node:assert/strict';
import test from 'node:test';
import { blogPostCreateSchema, publishableBlogPostSchema } from '@virtual-mandi/shared';

test('BlogPost form accepts English-only drafts', () => {
  const result = blogPostCreateSchema.parse({
    type: 'BLOG_POST',
    source: 'MANUAL',
    categoryIds: [],
    locationIds: [],
    translations: [{ locale: 'en-IN', title: 'Title', content: 'Content' }],
  });
  assert.equal(result.translations[0].locale, 'en-IN');
});

test('publishing schema requires English translation', () => {
  assert.throws(() =>
    publishableBlogPostSchema.parse({
      type: 'BLOG_POST',
      source: 'MANUAL',
      categoryIds: [],
      locationIds: [],
      translations: [{ locale: 'hi-IN', title: 'शीर्षक', content: 'सामग्री' }],
    }),
  );
  assert.doesNotThrow(() =>
    publishableBlogPostSchema.parse({
      type: 'BLOG_POST',
      source: 'MANUAL',
      categoryIds: [],
      locationIds: [],
      translations: [{ locale: 'en-IN', title: 'Title', content: 'Content' }],
    }),
  );
});
