import type { PostStatus } from './post.js';

export const ACTIVE_POST_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED',
] as const satisfies readonly PostStatus[];
export const FEED_POST_STATUSES = ['PUBLISHED'] as const satisfies readonly PostStatus[];

export const isFeedPostStatus = (status: PostStatus): status is 'PUBLISHED' =>
  status === 'PUBLISHED';
