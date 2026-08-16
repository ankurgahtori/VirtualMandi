import { prisma } from '../client.js';
import { seededBlogPost } from './fixtures/blog-posts.js';

export const seedBlogPost = async () => {
  const category = await prisma.category.findUniqueOrThrow({
    where: { key: seededBlogPost.categoryKey },
  });
  const location = await prisma.location.findUniqueOrThrow({
    where: { key: seededBlogPost.locationKey },
  });
  const locale = await prisma.locale.findUniqueOrThrow({
    where: { code: seededBlogPost.localeCode },
  });

  await prisma.blogPost.upsert({
    where: { postId: seededBlogPost.postId },
    update: {
      imageMediaId: seededBlogPost.mediaId,
      externalRedirectUrl: seededBlogPost.externalRedirectUrl,
      source: seededBlogPost.source,
      translations: {
        upsert: {
          where: {
            blogPostId_localeId: { blogPostId: seededBlogPost.postId, localeId: locale.id },
          },
          update: { title: seededBlogPost.title, content: seededBlogPost.content },
          create: {
            localeId: locale.id,
            title: seededBlogPost.title,
            content: seededBlogPost.content,
          },
        },
      },
    },
    create: {
      postId: seededBlogPost.postId,
      imageMediaId: seededBlogPost.mediaId,
      externalRedirectUrl: seededBlogPost.externalRedirectUrl,
      source: seededBlogPost.source,
      translations: {
        create: {
          localeId: locale.id,
          title: seededBlogPost.title,
          content: seededBlogPost.content,
        },
      },
    },
  });

  await prisma.postCategory.upsert({
    where: { postId_categoryId: { postId: seededBlogPost.postId, categoryId: category.id } },
    update: {},
    create: { postId: seededBlogPost.postId, categoryId: category.id },
  });
  await prisma.postLocation.upsert({
    where: { postId_locationId: { postId: seededBlogPost.postId, locationId: location.id } },
    update: {},
    create: { postId: seededBlogPost.postId, locationId: location.id },
  });
};
