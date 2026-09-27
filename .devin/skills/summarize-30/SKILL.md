---
name: summarize-30
description: Summarize a full post or scraped article into 20–30 words (aim for the upper end) — use whenever scraping/ingesting content to produce the short summary for a post.
argument-hint: '<post text, file path, URL, or post ID>'
allowed-tools:
  - read
  - exec
  - grep
  - glob
---

# Summarize a post in 20–30 words

Produce a tight summary of 20–30 words from a complete post — aim for the upper end of the range. The summary is displayed **alongside the post title**, so it must complement the title and entice the reader to open the post. Use this during scraping/ingestion workflows whenever a post needs a short summary.

## Getting the source text

Accept the post in whatever form the user provides:

- **Pasted text / file path** — use it directly (read the file if a path is given).
- **URL** — fetch it (`curl -sL <url>`) and extract the article body: strip HTML tags, navigation, ads, cookie banners, author bios, and comments.
- **Database post ID** — pull `title` + `content` from `BlogPostTranslation` via the postgres-expert pattern (`docker exec virtualmandi-postgres-1 psql ...`).

If the source is ambiguous or empty, stop and ask — do not invent a summary for content you have not seen.

## Summary rules

- **20–30 words.** Count them. Land as close to 30 as the source supports — never go under 20, never exceed 30. One or two plain sentences — no headline, no label, no bullet points.
- **Never duplicate the title.** Read the post title first. If the title already states a fact, do not restate it — pick the next-most-interesting detail from the body instead. The summary + title together should read like a headline and its teaser, not the same sentence twice.
- **Be the hook.** Write the summary so it adds something the title doesn't and makes the reader want to tap through: the surprising number, the consequence, the price trend, who it affects. Create curiosity without resorting to clickbait questions or withholding the story entirely.
- Lead with the most compelling fact _not already in the title_ (what happened / what is being sold, where, and the key number if any).
- Preserve specifics: commodity names, mandi/location names, prices, quantities, dates. Never generalize these away.
- Match the source language — if the post is in Hindi, summarize in Hindi; if English, summarize in English.
- Neutral but engaging tone. No opinion, no explicit call to action ("click to read"), no meta-commentary ("This post is about…"), no trailing ellipsis.
- If the source is too thin to reach 20 words without padding, keep it accurate at its natural length and flag it — never pad with filler.

## Output

Output only the 20–30-word summary by default. If the user asks to store it, write it to the location they specify (e.g., a `summary` column or the start of `content`) — confirm the exact target field first, since the schema currently has no dedicated summary column.

## Quick self-check before responding

1. Word count between 20 and 30? Recount after any edit; prefer the upper end.
2. Any phrase duplicated from the title? Rewrite it.
3. All numbers/names match the source?
4. Same language as the source?
