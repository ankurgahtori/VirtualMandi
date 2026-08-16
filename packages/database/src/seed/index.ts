import { disconnectDatabase } from '../client.js';
import { seedBlogPost } from './blog-post.seed.js';
import { seedCategories } from './category.seed.js';
import { seedLocales } from './locale.seed.js';
import { seedLocations } from './location.seed.js';
import { seedMedia } from './media.seed.js';
import { seedPost } from './post.seed.js';
import { seedUsers } from './user.seed.js';

const run = async () => {
  const admin = await seedUsers();
  await seedLocales();
  await seedLocations();
  await seedCategories();
  await seedMedia();
  await seedPost(admin.id);
  await seedBlogPost();
  console.log('Database seed completed: 1 published BLOG_POST fixture');
};

run()
  .catch((error) => {
    console.error('Database seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
