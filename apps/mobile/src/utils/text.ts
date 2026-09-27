const MAX_WORDS = 30;

/** First `limit` words of text, with a trailing ellipsis when truncated. */
export const firstWords = (text: string, limit = MAX_WORDS) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const truncated = words.slice(0, limit).join(' ');
  return words.length > limit ? `${truncated}…` : truncated;
};

/** Stored summary when present, otherwise the first 30 words of content. */
export const postExcerpt = (post: { summary?: string; content: string }) =>
  post.summary?.trim() || firstWords(post.content);
