import type { MediaDto } from '../media/types.js';
import type { PostSource, PostStatus, PostType } from '../constants/post.js';

export type PostSummary = {
  id: string;
  type: PostType;
  status: PostStatus;
  createdAt: string;
  updatedAt?: string;
  publishedAt?: string;
  categoryIds: string[];
  locationIds: string[];
};

export type BlogPostTranslationDto = {
  locale: string;
  title: string;
  content: string;
};

export type BlogPostDetailDto = PostSummary & {
  type: 'BLOG_POST';
  title: string;
  content: string;
  image?: MediaDto;
  externalRedirectUrl?: string;
  source: PostSource;
  requestedLocale: string;
  resolvedLocale: string;
  isEnglishFallback: boolean;
  translations?: BlogPostTranslationDto[];
  crawler?: {
    sourceItemId?: string;
    canonicalUrl?: string;
    fetchedAt?: string;
    crawlerName?: string;
    crawlerVersion?: string;
  };
};

export type PostDetailDto = BlogPostDetailDto;

export type BlogPostCreateInput = {
  type: 'BLOG_POST';
  source: PostSource;
  externalRedirectUrl?: string;
  imageMediaId?: string;
  categoryIds: string[];
  locationIds: string[];
  translations: BlogPostTranslationDto[];
};

export type BlogPostUpdateInput = Partial<Omit<BlogPostCreateInput, 'type'>>;
