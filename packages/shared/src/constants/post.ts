export const POST_TYPES = ['BLOG_POST'] as const;
export type PostType = (typeof POST_TYPES)[number];

export const POST_SOURCES = ['WHATSAPP', 'WEBSITE', 'MANUAL'] as const;
export type PostSource = (typeof POST_SOURCES)[number];

export const POST_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED', 'REMOVED'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];
